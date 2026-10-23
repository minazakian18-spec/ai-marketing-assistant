// Connection health per provider: one clear state, who has to act (the
// customer or the Mavix platform owner), the single next step, missing
// required permissions and optional extras. Pure; the server supplies facts.

export type ProviderId = "gmail" | "google_calendar" | "google_business" | "google_search_console" | "instagram" | "messenger" | "whatsapp" | "email_sending" | "google_ads";

/**
 * One status vocabulary for every integration (Integraties, Dashboard):
 *   connected      = verbonden en werkt;
 *   limited        = verbonden, maar een benodigde toestemming ontbreekt;
 *   action         = de klant moet iets kiezen of vernieuwen;
 *   reconnect      = de toegang is verlopen of ingetrokken;
 *   waiting        = wacht op goedkeuring van de provider (Google, Meta);
 *   not_configured = Mavix moet de koppeling nog inrichten;
 *   coming_soon    = in ontwikkeling;
 *   not_connected  = kan, maar is nog niet gekoppeld.
 * A connected account is not proof that every API call is allowed: "limited"
 * and the extras say what is missing.
 */
export type Status = "connected" | "limited" | "action" | "reconnect" | "waiting" | "not_configured" | "coming_soon" | "not_connected";
export const STATUS_LABEL: Record<Status, string> = {
  connected: "Verbonden",
  limited: "Beperkt",
  action: "Actie nodig",
  reconnect: "Opnieuw koppelen",
  waiting: "Wacht op provider",
  not_configured: "Nog niet ingericht",
  coming_soon: "Binnenkort",
  not_connected: "Niet gekoppeld",
};
export type HealthFacts = {
  provider: ProviderId;
  /** Mavix has the app credentials for this provider (platform-owner setup). */
  platformReady: boolean;
  /** External approval Mavix still waits for (for example Google API access). */
  pendingApproval?: string;
  connection: { status: string; scopes: string[]; lastSyncedAt: string | null; expiresAt: string | null } | null;
};
export type Health = {
  provider: ProviderId;
  label: string;
  state: "ready" | "attention" | "not_connected" | "pending_platform" | "pending_approval";
  status: Status;
  statusLabel: string;
  summary: string;
  actor: "customer" | "mavix" | "none";
  next: { label: string; href: string } | null;
  missing: string[];
  extras: { label: string; granted: boolean; note: string }[];
  lastSyncedAt: string | null;
};

const LABEL: Record<ProviderId, string> = {
  gmail: "Gmail",
  google_calendar: "Google Agenda",
  google_business: "Google Bedrijfsprofiel",
  google_search_console: "Google Search Console",
  instagram: "Instagram",
  messenger: "Facebook Messenger",
  whatsapp: "WhatsApp Business",
  email_sending: "E-mailcampagnes versturen",
  google_ads: "Google Ads",
};

// Required permissions in plain Dutch (any of the listed scope names counts).
const REQUIRED: Partial<Record<ProviderId, [string[], string][]>> = {
  gmail: [
    [["https://www.googleapis.com/auth/gmail.readonly"], "E-mail lezen"],
    [["https://www.googleapis.com/auth/gmail.send"], "E-mail versturen"],
  ],
  google_calendar: [[["https://www.googleapis.com/auth/calendar.events"], "Afspraken beheren"]],
  google_business: [[["https://www.googleapis.com/auth/business.manage"], "Bedrijfsprofiel en reviews beheren"]],
  instagram: [[["instagram_business_manage_messages", "instagram_manage_messages"], "Berichten lezen en beantwoorden"]],
  messenger: [[["pages_messaging"], "Messenger-berichten beantwoorden"]],
};

export function healthFor(f: HealthFacts): Health {
  const h = baseHealth(f);
  const conn = f.connection?.status || "";
  const status: Status =
    h.state === "ready"
      ? "connected"
      : h.state === "pending_approval"
        ? "waiting"
        : h.state === "pending_platform"
          ? f.provider === "google_ads"
            ? "coming_soon"
            : "not_configured"
          : h.state === "not_connected"
            ? "not_connected"
            : conn === "connected" && h.missing.length
              ? "limited"
              : ["reconnect_required", "permission_missing", "error"].includes(conn)
                ? "reconnect"
                : "action";
  return { ...h, status, statusLabel: STATUS_LABEL[status] };
}

function baseHealth(f: HealthFacts): Omit<Health, "status" | "statusLabel"> {
  const label = LABEL[f.provider];
  // Google Ads: no API connection exists yet (see /ads); separate from the
  // Google Business Profile API approval.
  if (f.provider === "google_ads") return { provider: f.provider, label, state: "pending_platform", summary: "In ontwikkeling: Mavix heeft nog geen koppeling met de Google Ads API.", actor: "mavix", next: { label: "Bekijken", href: "/ads" }, missing: [], extras: [], lastSyncedAt: null };
  // E-mail sending is a platform service (no customer OAuth): ready, or switched off.
  if (f.provider === "email_sending")
    return f.platformReady
      ? { provider: f.provider, label, state: "ready", summary: "Campagnes kunnen worden verstuurd naar contacten met aantoonbare toestemming.", actor: "none", next: null, missing: [], extras: [], lastSyncedAt: null }
      : { provider: f.provider, label, state: "pending_platform", summary: f.pendingApproval || "Versturen staat nog uit. Testmails werken wel.", actor: "mavix", next: null, missing: [], extras: [], lastSyncedAt: null };
  const c = f.connection;
  const scopes = c?.scopes || [];
  const missing = c && f.provider !== "whatsapp" && scopes.length ? (REQUIRED[f.provider] || []).filter(([names]) => !names.some((n) => scopes.includes(n))).map(([, l]) => l) : [];
  const extras =
    f.provider === "instagram"
      ? [
          { label: "Posts publiceren", granted: scopes.includes("instagram_content_publish") || scopes.includes("instagram_business_content_publish"), note: "Vraagt goedkeuring van Meta; daarna één keer opnieuw koppelen." },
          { label: "Bereik en interacties lezen", granted: scopes.includes("instagram_manage_insights") || scopes.includes("instagram_business_manage_insights"), note: "Nog niet aangevraagd bij Meta." },
        ]
      : [];
  const base = { provider: f.provider, label, missing, extras, lastSyncedAt: c?.lastSyncedAt || null };
  const fix = { label: "Opnieuw koppelen", href: "/account/integraties" };

  if (c && c.status === "connected" && !missing.length) {
    if (c.expiresAt && Date.parse(c.expiresAt) < Date.now() + 7 * 86400_000 && f.provider === "instagram")
      return { ...base, state: "attention", summary: "Verbonden, maar de toegang verloopt binnenkort. Koppel opnieuw om onderbreking te voorkomen.", actor: "customer", next: fix };
    return { ...base, state: "ready", summary: "Verbonden en werkt.", actor: "none", next: null };
  }
  if (c && c.status === "connected" && missing.length) return { ...base, state: "attention", summary: "Verbonden, maar er ontbreekt toestemming: " + missing.join(", ").toLowerCase() + ".", actor: "customer", next: fix };
  if (c && c.status === "selection_required") return { ...base, state: "attention", summary: "Bijna klaar: kies welk account of welke locatie Mavix gebruikt.", actor: "customer", next: { label: "Account kiezen", href: "/account/integraties?select=" + f.provider } };
  if (c && c.status === "api_access_required") return { ...base, state: "pending_approval", summary: f.pendingApproval || "Wacht op toegang van Google voor Mavix. Jij hoeft niets te doen.", actor: "mavix", next: null };
  if (c && ["reconnect_required", "permission_missing", "error"].includes(c.status)) return { ...base, state: "attention", summary: "De koppeling werkt niet meer (verlopen of toestemming ingetrokken).", actor: "customer", next: fix };
  if (!f.platformReady) return { ...base, state: "pending_platform", summary: "Mavix richt deze koppeling nog in. Je kunt nog niet koppelen; je hoeft niets te doen.", actor: "mavix", next: null };
  if (f.pendingApproval) return { ...base, state: "pending_approval", summary: f.pendingApproval, actor: "mavix", next: null };
  return { ...base, state: "not_connected", summary: "Nog niet gekoppeld.", actor: "customer", next: { label: "Koppelen", href: "/account/integraties" } };
}
