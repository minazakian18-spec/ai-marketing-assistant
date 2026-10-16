// Connection health per provider: one clear state, who has to act (the
// customer or the Mavix platform owner), the single next step, missing
// required permissions and optional extras. Pure; the server supplies facts.

export type ProviderId = "gmail" | "google_calendar" | "google_business" | "google_search_console" | "instagram" | "messenger" | "whatsapp";
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
  const label = LABEL[f.provider];
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
