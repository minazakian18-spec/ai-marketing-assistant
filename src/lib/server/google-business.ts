import "server-only";
import { adminClient } from "./supabase";
import { HttpError } from "./access";
import { encrypt, decrypt } from "./crypto";
import {
  ACCOUNT_ID,
  LOCATION_ID,
  REVIEW_ID,
  normalizeLocation,
  normalizeReview,
  normalizeReviewsPage,
  type BusinessLocation,
} from "../reviews/google";

// Google Business Profile: one connection (provider google_business) powers
// the business profile and Google Reviews. Same security model as Gmail and
// Calendar: encrypted credentials (AES-256-GCM, context workspace:provider),
// refresh before expiry, generation-guarded writes, nothing token-related ever
// leaves the server.

export const GBP_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/business.manage"];
export const GBP_MANAGE = "https://www.googleapis.com/auth/business.manage";
export const API_ACCESS_MESSAGE =
  "Google Bedrijfsprofiel is nog niet beschikbaar voor dit Mavix-project. API-toegang moet eerst door Google worden goedgekeurd.";
const PROVIDER = "google_business";
const context = (workspaceId: string) => workspaceId + ":" + PROVIDER;

/** Google has not (yet) granted this Cloud project access to the APIs. */
export class ApiAccessError extends HttpError {
  constructor() {
    super(403, API_ACCESS_MESSAGE);
  }
}

export type BusinessCredentials = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};
type Connection = {
  id: string;
  workspace_id: string;
  status: string;
  scopes: string[] | null;
  encrypted_credentials: string | null;
  expires_at: string | null;
  connection_generation: string;
  provider_account_id: string | null;
  account_email: string | null;
  display_name: string | null;
  connected_user: string | null;
  metadata: Record<string, unknown> | null;
};

// ---------------------------------------------------------------- Tokens

export async function exchangeBusinessToken(body: Record<string, string>): Promise<BusinessCredentials> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
    throw new HttpError(503, "Google-koppeling vereist configuratie.");
  let response: Response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...body, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET }),
    });
  } catch {
    throw new HttpError(503, "Google is tijdelijk niet bereikbaar. Probeer het later opnieuw.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (data.error === "invalid_grant") throw new HttpError(409, "Koppel Google Bedrijfsprofiel opnieuw.");
    if (response.status === 429) throw new HttpError(429, "Te veel aanvragen bij Google. Probeer het later opnieuw.");
    throw new HttpError(503, "Google-autorisatie is tijdelijk niet beschikbaar.");
  }
  if (
    typeof data.access_token !== "string" ||
    !data.access_token ||
    typeof data.expires_in !== "number" ||
    !Number.isFinite(data.expires_in) ||
    data.expires_in <= 0 ||
    data.expires_in > 86400 ||
    (data.token_type && String(data.token_type).toLowerCase() !== "bearer")
  )
    throw new HttpError(502, "Google-autorisatie kon niet worden gecontroleerd.");
  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
    ...(typeof data.refresh_token === "string" && data.refresh_token ? { refresh_token: data.refresh_token } : {}),
    ...(typeof data.scope === "string" ? { scope: data.scope } : {}),
  };
}

const USABLE = ["connected", "selection_required", "api_access_required"];

export async function businessConnection(workspaceId: string): Promise<Connection> {
  const { data: c, error } = await adminClient()
    .from("integration_connections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("provider", PROVIDER)
    .maybeSingle();
  if (error) throw new HttpError(503, "De verbinding kon niet worden geladen.");
  if (!c || !c.encrypted_credentials || c.status === "disconnected") throw new HttpError(409, "Koppel eerst Google Bedrijfsprofiel.");
  if (c.status === "permission_missing") throw new HttpError(403, "Toestemming voor Google Bedrijfsprofiel ontbreekt. Koppel opnieuw.");
  if (!USABLE.includes(c.status)) throw new HttpError(409, "Koppel Google Bedrijfsprofiel opnieuw.");
  return c as Connection;
}

/** Status changes are guarded by generation and ciphertext (no stale writes). */
export async function markBusinessConnection(c: Connection, status: string) {
  if (c.status === status) return;
  const { error } = await adminClient()
    .from("integration_connections")
    .update({ status })
    .eq("id", c.id)
    .eq("workspace_id", c.workspace_id)
    .eq("provider", PROVIDER)
    .eq("connection_generation", c.connection_generation)
    .eq("encrypted_credentials", c.encrypted_credentials);
  if (error) throw new HttpError(503, "De verbinding kon niet worden bijgewerkt.");
}

export async function businessToken(
  workspaceId: string,
  rejectedAccessToken?: string,
  attempt = 0,
): Promise<{ token: BusinessCredentials; c: Connection }> {
  const c = await businessConnection(workspaceId);
  if (!c.scopes?.includes(GBP_MANAGE)) {
    await markBusinessConnection(c, "permission_missing");
    throw new HttpError(403, "Toestemming voor Google Bedrijfsprofiel ontbreekt. Koppel opnieuw.");
  }
  let token = decrypt<BusinessCredentials>(c.encrypted_credentials!, context(workspaceId));
  const expiry = Date.parse(c.expires_at || "");
  if (Number.isFinite(expiry) && expiry > Date.now() + 60000 && token.access_token !== rejectedAccessToken) return { token, c };
  if (!token.refresh_token) {
    await markBusinessConnection(c, "reconnect_required");
    throw new HttpError(409, "Koppel Google Bedrijfsprofiel opnieuw.");
  }
  let refreshed: BusinessCredentials;
  try {
    refreshed = await exchangeBusinessToken({ grant_type: "refresh_token", refresh_token: token.refresh_token });
  } catch (error) {
    if (error instanceof HttpError && error.status === 409) await markBusinessConnection(c, "reconnect_required");
    throw error; // Network, configuration and rate-limit failures never revoke the connection.
  }
  token = { ...token, ...refreshed, refresh_token: refreshed.refresh_token || token.refresh_token };
  if (refreshed.scope && !refreshed.scope.split(" ").includes(GBP_MANAGE)) {
    await markBusinessConnection(c, "permission_missing");
    throw new HttpError(403, "Toestemming voor Google Bedrijfsprofiel ontbreekt. Koppel opnieuw.");
  }
  const patch = {
    encrypted_credentials: encrypt(token, context(workspaceId)),
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
  };
  const { data, error } = await adminClient()
    .from("integration_connections")
    .update(patch)
    .eq("id", c.id)
    .eq("workspace_id", workspaceId)
    .eq("provider", PROVIDER)
    .eq("connection_generation", c.connection_generation)
    .eq("encrypted_credentials", c.encrypted_credentials)
    .select("id");
  if (error) throw new HttpError(503, "De verbinding kon niet worden bijgewerkt.");
  if (!data?.length) {
    if (attempt >= 1) throw new HttpError(409, "De verbinding is gewijzigd. Probeer opnieuw.");
    return businessToken(workspaceId, undefined, attempt + 1);
  }
  return { token, c: { ...c, ...patch } };
}

// ---------------------------------------------------------------- Requests

type GoogleError = { error?: { status?: string; message?: string; details?: Record<string, unknown>[]; errors?: { reason?: string }[] } };

/** Detects "this Cloud project has no Business Profile API access (yet)". */
export function isApiAccessProblem(status: number, body: GoogleError) {
  const e = body?.error || {};
  const details = e.details || [];
  const reasons = [...details.map((d) => String(d.reason || "")), ...(e.errors || []).map((x) => String(x.reason || ""))];
  const quotaZero = details.some((d) => String((d.metadata as Record<string, unknown> | undefined)?.quota_limit_value ?? "") === "0");
  if (quotaZero) return true; // Unapproved projects get a quota of 0.
  if (reasons.some((r) => ["SERVICE_DISABLED", "API_DISABLED", "accessNotConfigured"].includes(r))) return true;
  return status === 403 && /has not been used in project|is disabled|not been enabled|API has not been enabled/i.test(e.message || "");
}

export async function businessRequest(workspaceId: string, url: string, init: RequestInit = {}, generation?: string) {
  let auth = await businessToken(workspaceId);
  if (generation && auth.c.connection_generation !== generation)
    throw new HttpError(409, "De koppeling met Google Bedrijfsprofiel is gewijzigd. Laad de pagina opnieuw.");
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: { ...init.headers, "Content-Type": "application/json", Authorization: "Bearer " + auth.token.access_token },
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new HttpError(
        503,
        init.method && init.method !== "GET"
          ? "Google heeft de wijziging niet bevestigd. Controleer de review voordat je het opnieuw probeert."
          : "Google Bedrijfsprofiel is tijdelijk niet bereikbaar. Probeer het opnieuw.",
      );
    }
    if (response.ok) {
      // A working call clears an earlier "API access required" state.
      if (auth.c.status === "api_access_required")
        await markBusinessConnection(auth.c, (auth.c.metadata as { location?: string } | null)?.location ? "connected" : "selection_required");
      return response.status === 204 ? {} : await response.json().catch(() => ({}));
    }
    if (response.status === 401 && attempt === 0) {
      auth = await businessToken(workspaceId, auth.token.access_token);
      continue;
    }
    const body = (await response.json().catch(() => ({}))) as GoogleError;
    if (response.status === 401) {
      await markBusinessConnection(auth.c, "reconnect_required");
      throw new HttpError(409, "Je koppeling met Google Bedrijfsprofiel is verlopen. Koppel opnieuw.");
    }
    if (isApiAccessProblem(response.status, body)) {
      await markBusinessConnection(auth.c, "api_access_required");
      throw new ApiAccessError();
    }
    const reason = [...(body.error?.details || []).map((d) => String(d.reason || "")), ...(body.error?.errors || []).map((x) => String(x.reason || ""))].join(" ");
    if (response.status === 403 && /ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficientPermissions/i.test(reason + " " + (body.error?.status || ""))) {
      await markBusinessConnection(auth.c, "permission_missing");
      throw new HttpError(403, "Toestemming voor Google Bedrijfsprofiel ontbreekt. Koppel opnieuw.");
    }
    if (response.status === 403) throw new HttpError(403, "Dit Google-account heeft geen toegang tot deze bedrijfslocatie.");
    if (response.status === 404) throw new HttpError(404, "Deze review of locatie bestaat niet meer bij Google.");
    if (response.status === 429) throw new HttpError(429, "Google Bedrijfsprofiel is even te druk. Probeer het over een minuut opnieuw.");
    if (response.status === 400) throw new HttpError(400, "Google heeft deze aanvraag afgewezen. Controleer de tekst en probeer het opnieuw.");
    throw new HttpError(502, "Google Bedrijfsprofiel kon tijdelijk niet worden geladen. Probeer het opnieuw.");
  }
  throw new HttpError(409, "Koppel Google Bedrijfsprofiel opnieuw.");
}

// ---------------------------------------------------------------- Accounts & locations

const ACCOUNTS_API = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts";
const INFO_API = "https://mybusinessbusinessinformation.googleapis.com/v1/";
const REVIEWS_API = "https://mybusiness.googleapis.com/v4/";

/** All locations the connected Google account can manage (bounded). */
export async function listBusinessLocations(workspaceId: string): Promise<BusinessLocation[]> {
  const accounts: string[] = [];
  let page = "";
  for (let i = 0; i < 5; i++) {
    const r = await businessRequest(workspaceId, ACCOUNTS_API + "?" + new URLSearchParams({ pageSize: "20", ...(page ? { pageToken: page } : {}) }));
    for (const a of (r.accounts || []) as { name?: string }[]) if (a.name && ACCOUNT_ID.test(a.name)) accounts.push(a.name);
    page = r.nextPageToken || "";
    if (!page) break;
  }
  const locations: BusinessLocation[] = [];
  for (const account of accounts.slice(0, 20)) {
    let token = "";
    for (let i = 0; i < 5 && locations.length < 500; i++) {
      const r = await businessRequest(
        workspaceId,
        INFO_API + account + "/locations?" + new URLSearchParams({ readMask: "name,title,storefrontAddress,openInfo,metadata", pageSize: "100", ...(token ? { pageToken: token } : {}) }),
      );
      for (const l of (r.locations || []) as Record<string, unknown>[]) {
        const n = normalizeLocation(l, account);
        if (n && !locations.some((x) => x.location === n.location)) locations.push(n);
      }
      token = r.nextPageToken || "";
      if (!token) break;
    }
  }
  return locations;
}

/** The pair must be returned by Google for this connection right now. */
export async function verifiedLocation(workspaceId: string, account: string, location: string) {
  if (!ACCOUNT_ID.test(account) || !LOCATION_ID.test(location)) throw new HttpError(400, "Ongeldige bedrijfslocatie.");
  const found = (await listBusinessLocations(workspaceId)).find((l) => l.account === account && l.location === location);
  if (!found) throw new HttpError(403, "Dit Google-account heeft geen toegang tot deze bedrijfslocatie.");
  return found;
}

export async function saveLocation(workspaceId: string, c: Pick<Connection, "id" | "connection_generation" | "metadata">, l: BusinessLocation) {
  const { data, error } = await adminClient()
    .from("integration_connections")
    .update({
      status: "connected",
      display_name: l.title,
      metadata: { ...(c.metadata || {}), account: l.account, location: l.location, locationTitle: l.title, locationAddress: l.address },
    })
    .eq("id", c.id)
    .eq("workspace_id", workspaceId)
    .eq("provider", PROVIDER)
    .eq("connection_generation", c.connection_generation)
    .select("id");
  if (error) throw new HttpError(503, "De locatie kon niet worden opgeslagen.");
  if (!data?.length) throw new HttpError(409, "De koppeling is gewijzigd. Probeer opnieuw.");
}

// ---------------------------------------------------------------- Reviews

async function selected(workspaceId: string) {
  const c = await businessConnection(workspaceId);
  const m = (c.metadata || {}) as { account?: string; location?: string };
  if (!m.account || !m.location || !ACCOUNT_ID.test(m.account) || !LOCATION_ID.test(m.location))
    throw new HttpError(409, "Kies eerst je bedrijfslocatie.");
  return { c, account: m.account, location: m.location, base: REVIEWS_API + m.account + "/" + m.location };
}
const reviewPath = (id: string) => {
  if (!REVIEW_ID.test(id)) throw new HttpError(400, "Ongeldige review.");
  return "/reviews/" + encodeURIComponent(id);
};

/** Raw v4 page (used by the research module). */
export async function rawReviewsPage(workspaceId: string, pageToken = "", pageSize = 50) {
  const s = await selected(workspaceId);
  return businessRequest(
    workspaceId,
    s.base + "/reviews?" + new URLSearchParams({ pageSize: String(Math.min(50, Math.max(1, pageSize))), orderBy: "updateTime desc", ...(pageToken ? { pageToken } : {}) }),
    {},
    s.c.connection_generation,
  );
}

export async function listGoogleReviews(workspaceId: string, input: { pageToken?: string; pageSize?: number }) {
  const s = await selected(workspaceId);
  if (input.pageToken && !/^[\w.~=+/-]{1,2000}$/.test(input.pageToken)) throw new HttpError(400, "Ongeldige pagina.");
  const raw = await rawReviewsPage(workspaceId, input.pageToken, input.pageSize);
  return normalizeReviewsPage(raw, s.location, !input.pageToken);
}

export async function getGoogleReview(workspaceId: string, id: string) {
  const s = await selected(workspaceId);
  const raw = await businessRequest(workspaceId, s.base + reviewPath(id), {}, s.c.connection_generation);
  const review = normalizeReview(raw, s.location);
  if (!review) throw new HttpError(404, "Deze review bestaat niet meer bij Google.");
  return review;
}

/** Creates or updates the owner reply; returns Google's accepted reply. */
export async function putReviewReply(workspaceId: string, id: string, comment: string) {
  const text = comment.replace(/\r\n/g, "\n").trim();
  if (!text || text.length > 4096) throw new HttpError(400, "Schrijf een antwoord van maximaal 4.096 tekens.");
  const s = await selected(workspaceId);
  const reply = await businessRequest(workspaceId, s.base + reviewPath(id) + "/reply", { method: "PUT", body: JSON.stringify({ comment: text }) }, s.c.connection_generation);
  if (typeof reply.comment !== "string") throw new HttpError(502, "Google heeft het antwoord niet bevestigd. Controleer de review.");
  return { comment: reply.comment as string, updateTime: typeof reply.updateTime === "string" ? reply.updateTime : new Date().toISOString() };
}

export async function deleteReviewReply(workspaceId: string, id: string) {
  const s = await selected(workspaceId);
  await businessRequest(workspaceId, s.base + reviewPath(id) + "/reply", { method: "DELETE" }, s.c.connection_generation);
}
