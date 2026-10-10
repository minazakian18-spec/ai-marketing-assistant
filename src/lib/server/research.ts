import "server-only";
import { adminClient } from "./supabase";
import { HttpError } from "./access";
import { connectionToken, listReviews } from "./integrations";
import { robotsAllows, safeFetchPage } from "./safe-fetch";
import { researchSummary } from "./ai";
import { metered } from "./ai-usage";
import { emptyWorkspace } from "../storage";
import type { Workspace } from "../types";
import { analyze } from "../research/rules";
import { buildReport, nextEligibleAt, researchPeriod } from "../research/report";
import { businessKindOf, contentFacts, emailFacts, profileFacts, reviewFacts, websiteFacts } from "../research/extract";
import type { GoogleProfileData, InboxData, ResearchInput, ResearchReport, ReviewData, SourceInfo, StageId, WebsiteData } from "../research/types";

// Research pipeline: collect (real sources only) -> analyze (rules) ->
// report (+ optional AI wording) -> persist. One run per workspace per
// calendar month, enforced by the unique (workspace_id, period) row.

const db = () => adminClient();
const STALE_MS = 15 * 60000;

type Row = {
  id: string;
  period: string;
  status: "running" | "completed" | "failed";
  stage: string | null;
  report: ResearchReport | null;
  error: string | null;
  started_at: string;
  completed_at: string | null;
  next_eligible_at: string;
};
const COLUMNS = "id,period,status,stage,report,error,started_at,completed_at,next_eligible_at";

function isStale(row: Pick<Row, "status" | "started_at">) {
  return row.status === "running" && Date.now() - Date.parse(row.started_at) > STALE_MS;
}

export async function researchState(workspaceId: string) {
  const period = researchPeriod();
  const { data, error } = await db().from("research_reports").select(COLUMNS).eq("workspace_id", workspaceId).order("period", { ascending: false }).limit(12);
  if (error) {
    console.error(JSON.stringify({ event: "research_not_provisioned", code: error.code || "error" }));
    throw new HttpError(503, "Onderzoek is nog niet beschikbaar. Probeer het later opnieuw.");
  }
  const rows = (data || []) as Row[];
  const current = rows.find((r) => r.period === period) || null;
  const usable = !current || current.status === "failed" || isStale(current);
  return {
    period,
    nextEligibleAt: nextEligibleAt(period),
    canRun: usable,
    current: current ? { ...current, status: isStale(current) ? ("failed" as const) : current.status } : null,
    history: rows.filter((r) => r.status === "completed").map((r) => ({ id: r.id, period: r.period, completedAt: r.completed_at })),
  };
}

export async function getReport(workspaceId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, "Onderzoek niet gevonden.");
  const { data } = await db().from("research_reports").select(COLUMNS).eq("workspace_id", workspaceId).eq("id", id).maybeSingle();
  if (!data || data.status !== "completed") throw new HttpError(404, "Onderzoek niet gevonden.");
  return data as Row;
}

// Claims this month's slot. Throws when the month is already used.
export async function startResearch(workspaceId: string, userId: string) {
  const period = researchPeriod();
  const row = { workspace_id: workspaceId, period, status: "running", stage: "collect", requested_by: userId, next_eligible_at: nextEligibleAt(period), started_at: new Date().toISOString() };
  const { data, error } = await db().from("research_reports").insert(row).select("id").single();
  if (!error) return data.id as string;
  if (error.code !== "23505") {
    console.error(JSON.stringify({ event: "research_not_provisioned", code: error.code || "error" }));
    throw new HttpError(503, "Onderzoek is nog niet beschikbaar. Probeer het later opnieuw.");
  }
  const { data: existing } = await db().from("research_reports").select(COLUMNS).eq("workspace_id", workspaceId).eq("period", period).single();
  const ex = existing as Row;
  if (ex.status === "completed") throw new HttpError(409, "Je maandelijkse onderzoek is al uitgevoerd.");
  if (ex.status === "running" && !isStale(ex)) throw new HttpError(409, "Het onderzoek loopt al.");
  // Retry a failed (or interrupted) run in the same monthly slot.
  const { data: claimed } = await db()
    .from("research_reports")
    .update({ status: "running", stage: "collect", error: null, report: null, started_at: new Date().toISOString(), requested_by: userId })
    .eq("id", ex.id)
    .in("status", ["failed", "running"])
    .select("id");
  if (!claimed?.length) throw new HttpError(409, "Het onderzoek loopt al.");
  return ex.id;
}

const setStage = (id: string, stage: StageId) => db().from("research_reports").update({ stage }).eq("id", id);

/* ---------- collectors ---------- */
async function workspaceData(workspaceId: string): Promise<Workspace> {
  const { data } = await db().from("business_profiles").select("data").eq("workspace_id", workspaceId).single();
  return { ...structuredClone(emptyWorkspace), contacts: [], library: [], ...(data?.data || {}) } as Workspace;
}

async function connections(workspaceId: string) {
  const { data } = await db().from("integration_connections").select("provider,status,metadata").eq("workspace_id", workspaceId);
  return data || [];
}

async function googleReviews(workspaceId: string): Promise<ReviewData> {
  const all: { starRating?: string; comment?: string; createTime?: string; reviewReply?: { comment?: string } }[] = [];
  let token = "";
  for (let i = 0; i < 4; i++) {
    const page = await listReviews(workspaceId, token);
    all.push(...(page.reviews || []));
    token = page.nextPageToken || "";
    if (!token) break;
  }
  return reviewFacts(all);
}

async function googleProfile(workspaceId: string, location: string): Promise<GoogleProfileData> {
  const fields = "title,categories,regularHours,websiteUri,phoneNumbers,profile";
  // Read-only and without side effects on the connection status.
  const { token } = await connectionToken(workspaceId, "google_business");
  const r = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${location}?readMask=${fields}`, {
    headers: { Authorization: "Bearer " + token.access_token },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error("google_profile_" + r.status);
  const d = await r.json();
  const desc = String(d.profile?.description || "");
  return {
    title: String(d.title || ""),
    hasHours: !!d.regularHours?.periods?.length,
    hasWebsite: !!d.websiteUri,
    hasPhone: !!d.phoneNumbers?.primaryPhone,
    hasDescription: desc.length > 0,
    descriptionLength: desc.length,
    categories: [d.categories?.primaryCategory?.displayName, ...(d.categories?.additionalCategories || []).map((c: { displayName?: string }) => c.displayName)].filter(Boolean),
  };
}

async function website(url: string): Promise<WebsiteData | undefined> {
  const target = /^https?:\/\//i.test(url) ? url : "https://" + url;
  if (!(await robotsAllows(target))) return undefined;
  const page = await safeFetchPage(target);
  if (page.status >= 400 || !page.html) return undefined;
  return websiteFacts(page.url, page.status, page.html, page.ms);
}

async function inboxStats(workspaceId: string, channels: string[]): Promise<InboxData | undefined> {
  if (!channels.length) return undefined;
  const now = Date.now();
  const { count: recent } = await db()
    .from("inbox_conversations")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .gt("last_message_at", new Date(now - 30 * 86400000).toISOString());
  const { count: waiting } = await db()
    .from("inbox_conversations")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("last_message_direction", "inbound")
    .neq("status", "resolved")
    .lt("last_message_at", new Date(now - 86400000).toISOString());
  return { conversations30: recent || 0, waitingOver24h: waiting || 0, channels };
}

/* ---------- pipeline ---------- */
export async function runResearch(workspaceId: string, id: string, userId?: string) {
  try {
    await setStage(id, "collect");
    const data = await workspaceData(workspaceId);
    const conns = await connections(workspaceId);
    const connected = (p: string) => conns.find((c) => c.provider === p && c.status === "connected");
    const sources: SourceInfo[] = [{ id: "profile", label: "Bedrijfsprofiel (Brand Hub)", status: "used", note: "Gegevens uit je Mavix-profiel." }];
    const profile = profileFacts(data);
    const input: ResearchInput = {
      businessKind: businessKindOf(profile.industry, profile.description),
      collectedAt: new Date().toISOString(),
      sources,
      profile,
      content: contentFacts(data),
      email: emailFacts(data),
    };

    await setStage(id, "reviews");
    const gbp = connected("google_business");
    const location = (gbp?.metadata as { location?: string } | undefined)?.location;
    if (gbp && location) {
      try {
        input.reviews = await googleReviews(workspaceId);
        sources.push({ id: "reviews", label: "Google-reviews", status: "used", note: `${input.reviews.total} reviews gelezen.` });
      } catch {
        sources.push({ id: "reviews", label: "Google-reviews", status: "error", note: "Reviews konden niet worden opgehaald." });
      }
    } else sources.push({ id: "reviews", label: "Google-reviews", status: "not_connected", note: "Google Bedrijfsprofiel is niet gekoppeld." });

    await setStage(id, "visibility");
    if (gbp && location) {
      try {
        input.google = await googleProfile(workspaceId, location);
        sources.push({ id: "google_profile", label: "Google Bedrijfsprofiel", status: "used", note: "Profielgegevens gecontroleerd." });
      } catch {
        sources.push({ id: "google_profile", label: "Google Bedrijfsprofiel", status: "error", note: "Profielgegevens konden niet worden opgehaald." });
      }
    } else sources.push({ id: "google_profile", label: "Google Bedrijfsprofiel", status: "not_connected", note: "Koppel Google Bedrijfsprofiel om je vermelding te laten controleren." });

    await setStage(id, "website");
    if (profile.website) {
      try {
        input.website = await website(profile.website);
        sources.push(
          input.website
            ? { id: "website", label: "Website", status: "used", note: "Homepage gecontroleerd." }
            : { id: "website", label: "Website", status: "error", note: "De homepage kon niet worden opgehaald of is afgeschermd voor bots." },
        );
      } catch {
        sources.push({ id: "website", label: "Website", status: "error", note: "De website was niet bereikbaar." });
      }
    } else sources.push({ id: "website", label: "Website", status: "unavailable", note: "Er staat geen website in je bedrijfsprofiel." });

    await setStage(id, "content");
    sources.push({ id: "content", label: "Content in Mavix", status: "used", note: "Posts die via Mavix zijn gemaakt of gepland." });
    sources.push({ id: "email", label: "E-mail en contacten", status: "used", note: "Campagnes en contacten in Mavix." });
    const inboxChannels = ["gmail", "instagram", "messenger", "whatsapp"].filter((p) => connected(p));
    input.inbox = await inboxStats(workspaceId, inboxChannels).catch(() => undefined);
    if (input.inbox) sources.push({ id: "inbox", label: "Inbox", status: "used", note: "Klantgesprekken van de afgelopen 30 dagen." });
    sources.push({ id: "instagram_insights", label: "Instagram-statistieken", status: "unavailable", note: "Bereik en engagement kunnen nog niet worden uitgelezen." });

    await setStage(id, "advice");
    const findings = analyze(input);
    const period = researchPeriod();
    let report = buildReport(input, findings, period);
    const ai = process.env.ANTHROPIC_API_KEY && userId ? await metered({ workspaceId, user: { id: userId } }, "research", () => researchSummary(report)).catch(() => null) : null;
    if (ai) report = { ...report, summary: ai, summarySource: "ai" };

    const { error } = await db()
      .from("research_reports")
      .update({ status: "completed", stage: null, report, sources, completed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    console.info(JSON.stringify({ event: "research_completed", findings: findings.length }));
  } catch (e) {
    console.error(JSON.stringify({ event: "research_failed", code: e instanceof HttpError ? e.status : 500 }));
    await db().from("research_reports").update({ status: "failed", stage: null, error: "Het onderzoek kon niet worden afgerond. Probeer het opnieuw." }).eq("id", id);
  }
}
