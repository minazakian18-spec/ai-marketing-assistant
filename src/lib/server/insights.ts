import "server-only";
import { adminClient } from "./supabase";
import { readWorkspace } from "./workspace-store";
import { listGoogleReviews } from "./google-business";
import { searchPerformance } from "./search-console";
import { periodCompare, type Metric, type SourceBlock } from "../insights";
import type { Post } from "../types";
import type { EmailCampaign } from "../email-model";

// Marketing results for Insights, only from measured sources:
//   - Mavix itself: content made, approved, really published/sent;
//   - Google Search Console (when a property is linked in SEO Intelligence);
//   - Google Business Profile reviews (when connected);
//   - e-mail campaigns sent through Mavix (provider delivery events);
//   - Instagram publications done through Mavix (reach/engagement need an
//     extra Meta permission, so they are reported as not available).
// Every block says where its numbers come from; a source that cannot deliver
// says why instead of showing zeros.

const db = () => adminClient();
const DAY = 86400_000;

export async function insights(workspaceId: string, now = Date.now()) {
  const ws = await readWorkspace(workspaceId);
  const { data: conns } = await db().from("integration_connections").select("provider,status").eq("workspace_id", workspaceId);
  const connected = (p: string) => (conns || []).some((c) => c.provider === p && c.status === "connected");
  const posts = (ws.posts || []) as Post[];
  const mails = ((ws.email as { campaigns?: EmailCampaign[] })?.campaigns || []) as EmailCampaign[];
  const blocks: SourceBlock[] = [];

  // Mavix activity (always measured: it is the workspace's own data).
  const created = (d?: string) => (d ? Date.parse(d) : NaN);
  blocks.push({
    id: "activity",
    source: "Mavix",
    title: "Je marketingactiviteit",
    available: true,
    period: "30 dagen vs. de 30 dagen ervoor",
    href: "/studio",
    metrics: [
      periodCompare("Instagram-posts gemaakt", posts.map((p) => created(p.createdAt)), now),
      periodCompare("E-mails gemaakt", mails.map((c) => created(c.createdAt)), now),
      periodCompare("Echt gepubliceerd op Instagram", posts.filter((p) => p.instagram?.mediaId).map((p) => created(p.instagram!.publishedAt)), now),
      periodCompare("Echt verstuurde campagnes", mails.filter((c) => c.delivery).map((c) => created(c.delivery!.sentAt)), now),
    ],
  });

  // Search Console via the property linked in SEO Intelligence.
  const { data: sites } = await db().from("seo_sites").select("host,gsc_property").eq("workspace_id", workspaceId).not("gsc_property", "is", null).limit(1);
  const property = (sites?.[0]?.gsc_property as string) || "";
  if (!connected("google_search_console")) blocks.push({ id: "search", source: "Google Search Console", title: "Zoekresultaten in Google", available: false, reason: "Koppel Google Search Console om klikken en vertoningen te zien.", href: "/account/integraties" });
  else if (!property) blocks.push({ id: "search", source: "Google Search Console", title: "Zoekresultaten in Google", available: false, reason: "Kies in SEO Intelligence welke Search Console-property bij je website hoort.", href: "/seo" });
  else
    try {
      const perf = await searchPerformance(workspaceId, property, 56);
      const days = [...perf.daily].sort((a, b) => a.date.localeCompare(b.date));
      const cur = days.slice(-28),
        prev = days.slice(-56, -28);
      const sum = (rows: typeof days, k: "clicks" | "impressions") => rows.reduce((s, r) => s + r[k], 0);
      const metric = (label: string, k: "clicks" | "impressions"): Metric => ({ label, value: sum(cur, k), previous: prev.length >= 20 ? sum(prev, k) : null });
      blocks.push({ id: "search", source: "Google Search Console", title: "Zoekresultaten in Google", available: true, period: "28 dagen vs. de 28 dagen ervoor (Google loopt ~3 dagen achter)", href: "/seo", metrics: [metric("Klikken", "clicks"), metric("Vertoningen", "impressions")] });
    } catch {
      blocks.push({ id: "search", source: "Google Search Console", title: "Zoekresultaten in Google", available: false, reason: "Search Console gaf nu geen gegevens terug. Probeer het later opnieuw of controleer de koppeling.", href: "/account/integraties" });
    }

  // Google reviews.
  if (!connected("google_business")) blocks.push({ id: "reviews", source: "Google Bedrijfsprofiel", title: "Google-reviews", available: false, reason: "Koppel Google Bedrijfsprofiel om je reviews en score te volgen.", href: "/account/integraties" });
  else
    try {
      const page = await listGoogleReviews(workspaceId, { pageSize: 50 });
      const times = page.reviews.map((r) => Date.parse(r.createTime));
      blocks.push({
        id: "reviews",
        source: "Google Bedrijfsprofiel",
        title: "Google-reviews",
        available: true,
        period: "Score en totaal volgens Google; aantallen over de laatste 50 reviews",
        href: "/reviews",
        metrics: [
          { label: "Gemiddelde score", value: page.averageRating, previous: null },
          { label: "Reviews in totaal", value: page.totalReviewCount, previous: null },
          periodCompare("Nieuwe reviews", times, now),
          { label: "Onbeantwoord", value: page.reviews.filter((r) => !r.reply).length, previous: null },
        ],
      });
    } catch {
      blocks.push({ id: "reviews", source: "Google Bedrijfsprofiel", title: "Google-reviews", available: false, reason: "Google gaf nu geen reviews terug. Bekijk de status bij Integraties.", href: "/account/integraties" });
    }

  // E-mail delivery (provider events of real sends).
  const since = new Date(now - 30 * DAY).toISOString();
  const { data: runs } = await db().from("email_campaign_runs").select("id,sent,created_at").eq("workspace_id", workspaceId).eq("kind", "send").gte("created_at", since);
  if (!runs?.length) blocks.push({ id: "email", source: "E-mail via Mavix", title: "E-mailresultaten", available: false, reason: "Nog geen campagne verstuurd via Mavix in de afgelopen 30 dagen.", href: "/email" });
  else {
    const { data: rows } = await db().from("email_deliveries").select("status,opened_at,clicked_at").in("run_id", runs.map((r) => r.id)).limit(20000);
    const d = rows || [];
    const sent = runs.reduce((s, r) => s + (r.sent || 0), 0);
    blocks.push({
      id: "email",
      source: "E-mail via Mavix",
      title: "E-mailresultaten",
      available: true,
      period: "Laatste 30 dagen, volgens de e-mailprovider",
      href: "/email",
      metrics: [
        { label: "Verstuurd", value: sent, previous: null },
        { label: "Afgeleverd", value: d.filter((x) => x.status === "delivered").length, previous: null },
        { label: "Geopend (indicatie)", value: d.filter((x) => x.opened_at).length, previous: null },
        { label: "Geklikt", value: d.filter((x) => x.clicked_at).length, previous: null },
        { label: "Bounces en klachten", value: d.filter((x) => x.status === "bounced" || x.status === "complained").length, previous: null },
      ],
    });
  }

  // Instagram: Mavix knows its own publications; reach needs instagram_manage_insights.
  blocks.push({
    id: "instagram",
    source: "Instagram",
    title: "Instagram-bereik en interacties",
    available: false,
    reason: connected("instagram") ? "Bereik, likes en reacties leest Mavix nog niet uit: daarvoor is een extra Meta-toestemming (instagram_manage_insights) nodig." : "Koppel Instagram. Bereik en interacties volgen zodra Meta de extra toestemming heeft goedgekeurd.",
    href: connected("instagram") ? "/social" : "/account/integraties",
  });
  return { generatedAt: new Date(now).toISOString(), blocks };
}
