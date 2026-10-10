"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Loader2, MapPin, RefreshCw, X } from "lucide-react";
import { BrandIcon, type Brand } from "@/components/brand-icon";
import { IconButton } from "@/components/ui";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import { isBrowserDemo } from "@/lib/demo";
import type { BusinessLocation } from "@/lib/reviews/google";

// Shape of GET /api/integrations/{google_calendar|gmail|google_business}/status.
type Status = {
  status: string;
  connected: boolean;
  accountEmail: string | null;
  mine?: boolean;
  lastSyncedAt?: string | null;
  location?: { name: string; address: string } | null;
};
type Place = { name: string; address: string } | null;
type View =
  | { kind: "loading" }
  | { kind: "load-error"; message: string }
  | { kind: "disconnected" }
  | { kind: "connected"; email: string; lastSyncedAt?: string | null; place: Place }
  | { kind: "team" }
  | { kind: "selection"; email: string | null }
  | { kind: "api"; email: string | null }
  | { kind: "reconnect"; reason: "expired" | "permission" | "other"; email: string | null };

export type GoogleCardConfig = {
  provider: "google_calendar" | "gmail" | "google_business" | "google_search_console";
  brand: Brand;
  name: string;
  rights: string[];
  copy: {
    disconnected: string;
    connected: string;
    expired: string;
    permission: string;
    team?: string;
    disconnect: string;
  };
  /** Extra guidance in the Beheren dialog for a working connection. */
  manageHint: ReactNode;
  /** Google Business Profile: choose a business location after OAuth. */
  locations?: boolean;
};

export const API_ACCESS_TEXT =
  "Google Bedrijfsprofiel is nog niet beschikbaar voor dit Mavix-project. API-toegang moet eerst door Google worden goedgekeurd.";

export const CALENDAR_CARD: GoogleCardConfig = {
  provider: "google_calendar",
  brand: "google_calendar",
  name: "Google Agenda",
  rights: ["Je Google-account herkennen (e-mailadres)", "Je lijst met agenda's bekijken", "Afspraken bekijken, maken, wijzigen en verwijderen"],
  copy: {
    disconnected: "Synchroniseer je afspraken met Mavix.",
    connected: "Je afspraken staan naast je Mavix-planning in de Kalender.",
    expired: "De koppeling is verlopen of ingetrokken. Koppel opnieuw om je afspraken weer te zien.",
    permission: "Mavix mist toegang tot je agenda's. Koppel opnieuw en sta alle gevraagde toegang toe.",
    team: "Gekoppeld door een teamlid. Die agenda is privé en alleen voor diegene zichtbaar.",
    disconnect:
      "Mavix stopt met synchroniseren en verwijdert de opgeslagen toegang. Je afspraken in Google Agenda blijven gewoon bestaan. Je kunt later opnieuw koppelen.",
  },
  manageHint: (
    <>
      Kies in de <Link href="/calendar">Kalender</Link> welke agenda&apos;s je wilt zien en of geplande Mavix-content ook in Google Agenda komt.
    </>
  ),
};

export const GMAIL_CARD: GoogleCardConfig = {
  provider: "gmail",
  brand: "gmail",
  name: "Gmail",
  rights: ["Je Google-account herkennen (e-mailadres)", "E-mails lezen voor je Inbox", "E-mails versturen namens jou"],
  copy: {
    disconnected: "Beheer je klantmails rechtstreeks vanuit Mavix.",
    connected: "Klantmails komen binnen in je Inbox en je antwoordt vanuit Mavix.",
    expired: "Je Gmail-koppeling is verlopen.",
    permission: "Mavix mist toegang tot Gmail. Koppel opnieuw en sta lezen en versturen toe.",
    disconnect:
      "Mavix stopt met synchroniseren en verwijdert de opgeslagen toegang. Je e-mails in Gmail blijven gewoon bestaan. Google Agenda en inloggen met Google blijven werken.",
  },
  manageHint: (
    <>
      Je e-mails staan in de <Link href="/inbox">Inbox</Link> onder E-mail. Mavix haalt nieuwe e-mail ongeveer elke minuut op zolang de Inbox open is (geen realtime).
    </>
  ),
};

export const BUSINESS_CARD: GoogleCardConfig = {
  provider: "google_business",
  brand: "google_business",
  name: "Google Bedrijfsprofiel",
  rights: ["Je Google-account herkennen (e-mailadres)", "Je bedrijfsprofielen en locaties bekijken", "Reviews lezen en beantwoorden"],
  copy: {
    disconnected: "Beheer je bedrijfsprofiel en reviews rechtstreeks vanuit Mavix.",
    connected: "Je Google-reviews staan in Mavix en je antwoordt direct vanuit Reviews.",
    expired: "Je koppeling met Google Bedrijfsprofiel is verlopen.",
    permission: "Mavix mist toegang tot je bedrijfsprofiel. Koppel opnieuw en sta beheer toe.",
    disconnect:
      "Mavix verwijdert de opgeslagen toegang en de gekozen locatie. Je bedrijfsprofiel, reviews en antwoorden bij Google blijven gewoon bestaan. Gmail, Google Agenda en inloggen met Google blijven werken.",
  },
  manageHint: (
    <>
      Je reviews en antwoorden vind je onder <Link href="/reviews?tab=inbox">Reviews</Link>. Google blijft de bron: wat je plaatst, staat direct op Google.
    </>
  ),
  locations: true,
};

export const SEARCH_CONSOLE_CARD: GoogleCardConfig = {
  provider: "google_search_console",
  brand: "search_console",
  name: "Google Search Console",
  rights: ["Je Google-account herkennen (e-mailadres)", "Zoekgegevens van je websites bekijken (alleen lezen)"],
  copy: {
    disconnected: "Zie klikken, vertoningen en zoekwoorden van je website in SEO Intelligence.",
    connected: "Je zoekgegevens staan in SEO Intelligence onder Zoekresultaten.",
    expired: "Je koppeling met Search Console is verlopen.",
    permission: "Mavix mist leestoegang tot Search Console. Koppel opnieuw en sta de toegang toe.",
    disconnect: "Mavix verwijdert de opgeslagen toegang. In Search Console verandert niets. Andere Google-koppelingen blijven werken.",
  },
  manageHint: (
    <>
      Bekijk je zoekgegevens in <Link href="/seo">SEO Intelligence</Link>. Alleen websites waar je Google-account toegang toe heeft in Search Console zijn zichtbaar.
    </>
  ),
};

const dateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Nog niet";

function viewOf(s: Status): View {
  if (s.status === "disconnected") return { kind: "disconnected" };
  if (s.connected) return { kind: "connected", email: s.accountEmail || "", lastSyncedAt: s.lastSyncedAt, place: s.location || null };
  if (s.status === "selection_required") return { kind: "selection", email: s.accountEmail };
  if (s.status === "api_access_required") return { kind: "api", email: s.accountEmail };
  if (s.status === "connected" && s.mine === false) return { kind: "team" };
  return {
    kind: "reconnect",
    reason: s.status === "reconnect_required" ? "expired" : s.status === "permission_missing" ? "permission" : "other",
    email: s.accountEmail,
  };
}

// One Google integration row with real states (status endpoint per provider):
// loading, not connected, connecting, connected, team member, location choice,
// API access pending, reconnect and load error. Tokens never reach the browser.
export function GoogleIntegrationCard({
  config,
  demo,
  onNotice,
  openPicker = false,
}: {
  config: GoogleCardConfig;
  demo: boolean;
  onNotice: (message: string) => void;
  /** Open the location picker right away (after OAuth with several locations). */
  openPicker?: boolean;
}) {
  const base = "/api/integrations/" + config.provider + "/";
  const [view, setView] = useState<View>({ kind: "loading" });
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState("");
  const [manage, setManage] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [picker, setPicker] = useState<null | { loading: boolean; error: string; list: BusinessLocation[]; choice: string; saving: boolean }>(null);

  const request = useCallback(
    async <T,>(path: string, method: "GET" | "POST" = "GET", body: unknown = {}): Promise<T> => {
      const r = await fetch(base + path, method === "POST" ? { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Er ging iets mis. Probeer het opnieuw.");
      return d as T;
    },
    [base],
  );

  const load = useCallback(async () => {
    try {
      setView(viewOf(await request<Status>("status")));
    } catch (e) {
      setView({ kind: "load-error", message: (e as Error).message });
    }
  }, [request]);

  const openLocations = useCallback(async () => {
    setManage(false);
    setPicker({ loading: true, error: "", list: [], choice: "", saving: false });
    try {
      const { locations } = await request<{ locations: BusinessLocation[] }>("locations");
      setPicker({ loading: false, error: "", list: locations, choice: locations.length === 1 ? locations[0].location : "", saving: false });
      void load(); // A working call may have cleared an "API access" state.
    } catch (e) {
      setPicker({ loading: false, error: (e as Error).message, list: [], choice: "", saving: false });
      void load();
    }
  }, [request, load]);

  useEffect(() => {
    // The page learns about test mode after mount, so check the cookie here too.
    if (isBrowserDemo()) setView({ kind: "disconnected" });
    else void load();
  }, [load]);
  useEffect(() => {
    if (openPicker && config.locations && !isBrowserDemo()) void openLocations();
  }, [openPicker, config.locations, openLocations]);

  async function connect() {
    setConnecting(true);
    setError("");
    try {
      const { url } = await request<{ url: string }>("connect", "POST");
      window.location.assign(url); // Google consent screen; the callback returns to Mavix.
    } catch (e) {
      setError((e as Error).message);
      setConnecting(false);
    }
  }

  async function chooseLocation() {
    if (!picker) return;
    const pick = picker.list.find((l) => l.location === picker.choice);
    if (!pick) return setPicker({ ...picker, error: "Kies eerst een locatie." });
    setPicker({ ...picker, saving: true, error: "" });
    try {
      await request("select", "POST", { account: pick.account, location: pick.location });
      setPicker(null);
      onNotice(pick.title + " is gekoppeld. Je reviews staan nu onder Reviews.");
      void load();
    } catch (e) {
      setPicker({ ...picker, saving: false, error: (e as Error).message });
    }
  }

  async function disconnect() {
    setConfirm(false);
    setDisconnecting(true);
    setError("");
    try {
      await request("disconnect", "POST");
      setManage(false);
      setView({ kind: "disconnected" });
      onNotice(config.name + " is ontkoppeld.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDisconnecting(false);
    }
  }

  const busy = connecting || disconnecting;
  const linked = view.kind === "connected" || view.kind === "team" || view.kind === "reconnect" || view.kind === "selection" || view.kind === "api";
  const state =
    view.kind === "connected"
      ? { cls: "connected", text: "Verbonden" }
      : view.kind === "team"
        ? { cls: "selection", text: "Teamlid" }
        : view.kind === "selection"
          ? { cls: "selection", text: "Locatie nodig" }
          : view.kind === "api"
            ? { cls: "permission", text: "Wacht op Google" }
            : view.kind === "reconnect"
              ? { cls: view.reason === "permission" ? "permission" : "reconnect", text: view.reason === "permission" ? "Toestemming nodig" : view.reason === "expired" ? "Verlopen" : "Fout bij koppeling" }
              : view.kind === "load-error"
                ? { cls: "error", text: "Niet beschikbaar" }
                : view.kind === "loading"
                  ? { cls: "loading", text: "Laden…" }
                  : { cls: "disconnected", text: "Niet verbonden" };

  const description =
    view.kind === "connected"
      ? config.copy.connected
      : view.kind === "team"
        ? config.copy.team || config.copy.connected
        : view.kind === "selection"
          ? "Google-account gekoppeld. Kies je bedrijfslocatie."
          : view.kind === "api"
            ? API_ACCESS_TEXT
            : view.kind === "reconnect"
              ? view.reason === "expired"
                ? config.copy.expired
                : view.reason === "permission"
                  ? config.copy.permission
                  : "Er is een probleem met de koppeling. Koppel opnieuw."
              : view.kind === "load-error"
                ? view.message
                : config.copy.disconnected;

  const connectButton = (label: string, primary = true) => (
    <button type="button" className={"button " + (primary ? "primary" : "secondary")} disabled={demo || busy || view.kind === "loading"} onClick={() => void connect()}>
      {connecting ? <Loader2 size={14} className="int-spin" aria-hidden="true" /> : null}
      {connecting ? "Doorsturen…" : label}
    </button>
  );
  const disconnectButton = (
    <button type="button" className="button danger-text" onClick={() => setConfirm(true)} disabled={busy}>
      {disconnecting ? "Ontkoppelen…" : "Ontkoppelen"}
    </button>
  );
  const titleId = "gi-modal-" + config.provider;
  const email = view.kind === "connected" ? view.email : view.kind === "reconnect" || view.kind === "selection" || view.kind === "api" ? view.email : null;

  return (
    <li className="int-row int-gc" aria-busy={view.kind === "loading" || busy}>
      <span className="int-logo">
        <BrandIcon brand={config.brand} size={24} />
      </span>
      <div className="int-info">
        <strong>{config.name}</strong>
        <p className={view.kind === "reconnect" || view.kind === "load-error" || view.kind === "api" ? "int-warn" : undefined}>{description}</p>
        {view.kind === "connected" && view.place && (
          <small className="int-place">
            <MapPin size={12} aria-hidden="true" />
            {view.place.name}
            {email ? " · " + email : ""}
          </small>
        )}
        {email && !(view.kind === "connected" && view.place) && <small>{email}</small>}
        {error && !manage && (
          <p role="alert" className="int-error int-inline-error">
            {error}
          </p>
        )}
      </div>
      <span className={"int-state is-" + state.cls}>{state.text}</span>
      <div className="int-actions">
        {view.kind === "loading" ? (
          <span className="int-skeleton" aria-hidden="true" />
        ) : view.kind === "load-error" ? (
          <button type="button" className="button secondary" onClick={() => void load()}>
            <RefreshCw size={14} aria-hidden="true" />
            Opnieuw proberen
          </button>
        ) : view.kind === "connected" ? (
          <>
            <button type="button" className="button secondary" onClick={() => setManage(true)} disabled={busy}>
              Beheren
            </button>
            {disconnectButton}
          </>
        ) : view.kind === "team" ? (
          <button type="button" className="button secondary" onClick={() => setManage(true)} disabled={busy}>
            Beheren
          </button>
        ) : view.kind === "selection" ? (
          <>
            <button type="button" className="button primary" onClick={() => void openLocations()} disabled={demo || busy}>
              Locatie kiezen
            </button>
            {disconnectButton}
          </>
        ) : view.kind === "api" ? (
          <>
            <button type="button" className="button secondary" onClick={() => void openLocations()} disabled={demo || busy}>
              <RefreshCw size={14} aria-hidden="true" />
              Opnieuw controleren
            </button>
            {disconnectButton}
          </>
        ) : view.kind === "reconnect" ? (
          connectButton("Opnieuw koppelen")
        ) : (
          connectButton("Koppelen")
        )}
      </div>

      {manage && linked && (
        <>
          <div className="int-scrim" onClick={() => setManage(false)} aria-hidden="true" />
          <div className="int-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <header>
              <BrandIcon brand={config.brand} size={26} />
              <div>
                <h2 id={titleId}>{config.name}</h2>
                <span className={"int-state is-" + state.cls}>{state.text}</span>
              </div>
              <IconButton label="Sluiten" onClick={() => setManage(false)}>
                <X size={16} />
              </IconButton>
            </header>
            <div className="int-modal-body">
              {error && (
                <p role="alert" className="int-error">
                  {error}
                </p>
              )}
              <dl className="int-details">
                <dt>Account</dt>
                <dd>{view.kind === "team" ? "Privé (teamlid)" : email || "—"}</dd>
                {view.kind === "connected" && view.place && (
                  <>
                    <dt>Locatie</dt>
                    <dd>
                      {view.place.name}
                      {view.place.address && <span className="int-sub">{view.place.address}</span>}
                    </dd>
                  </>
                )}
                <dt>Status</dt>
                <dd>{state.text}</dd>
                {view.kind === "connected" && view.lastSyncedAt !== undefined && (
                  <>
                    <dt>Laatst gesynchroniseerd</dt>
                    <dd>{dateTime(view.lastSyncedAt)}</dd>
                  </>
                )}
                <dt>Rechten</dt>
                <dd>
                  <ul className="int-scopes">
                    {config.rights.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </dd>
              </dl>
              <p className="int-hint">{view.kind === "connected" ? config.manageHint : view.kind === "team" ? config.copy.team : description}</p>
              <p className="int-hint">Ontkoppelen verwijdert de opgeslagen toegang in Mavix. Er wordt niets in je Google-account verwijderd.</p>
            </div>
            <footer>
              {disconnectButton}
              {config.locations && view.kind === "connected" && (
                <button type="button" className="button secondary" onClick={() => void openLocations()} disabled={busy}>
                  Andere locatie kiezen
                </button>
              )}
              {connectButton(view.kind === "team" ? "Eigen account koppelen" : "Opnieuw koppelen", view.kind !== "connected")}
            </footer>
          </div>
        </>
      )}

      {picker && (
        <>
          <div className="int-scrim" onClick={() => !picker.saving && setPicker(null)} aria-hidden="true" />
          <div className="int-modal" role="dialog" aria-modal="true" aria-labelledby={titleId + "-loc"}>
            <header>
              <BrandIcon brand={config.brand} size={26} />
              <div>
                <h2 id={titleId + "-loc"}>Kies je bedrijfslocatie</h2>
                <span className="int-sub">Mavix beheert de reviews van deze locatie.</span>
              </div>
              <IconButton label="Sluiten" onClick={() => setPicker(null)} disabled={picker.saving}>
                <X size={16} />
              </IconButton>
            </header>
            <div className="int-modal-body">
              {picker.loading ? (
                <div className="int-loc-skeleton" role="status" aria-label="Locaties laden">
                  <span />
                  <span />
                </div>
              ) : picker.error && !picker.list.length ? (
                <p role="alert" className={picker.error === API_ACCESS_TEXT ? "int-hint int-warn" : "int-error"}>
                  {picker.error}
                </p>
              ) : !picker.list.length ? (
                <p className="int-hint">
                  Er is geen bedrijfslocatie gevonden voor dit Google-account. Controleer in Google Bedrijfsprofiel of je eigenaar of beheerder bent, of koppel een ander Google-account.
                </p>
              ) : (
                <fieldset className="int-locations" disabled={picker.saving}>
                  <legend className="sr-only">Bedrijfslocaties</legend>
                  {picker.list.map((l) => (
                    <label key={l.location} className={"int-location" + (picker.choice === l.location ? " is-chosen" : "")}>
                      <input type="radio" name="gbp-location" value={l.location} checked={picker.choice === l.location} onChange={() => setPicker({ ...picker, choice: l.location, error: "" })} />
                      <span>
                        <strong>{l.title}</strong>
                        {l.address && <small>{l.address}</small>}
                      </span>
                      {l.closed && <em>Permanent gesloten</em>}
                      {!l.closed && l.verified === false && <em>Niet geverifieerd</em>}
                    </label>
                  ))}
                </fieldset>
              )}
              {picker.error && picker.list.length > 0 && (
                <p role="alert" className="int-error">
                  {picker.error}
                </p>
              )}
            </div>
            <footer>
              <button type="button" className="button secondary" onClick={() => setPicker(null)} disabled={picker.saving}>
                Annuleren
              </button>
              <button type="button" className="button primary" onClick={() => void chooseLocation()} disabled={picker.loading || picker.saving || !picker.choice}>
                {picker.saving ? <Loader2 size={14} className="int-spin" aria-hidden="true" /> : null}
                {picker.saving ? "Controleren bij Google…" : "Locatie koppelen"}
              </button>
            </footer>
          </div>
        </>
      )}

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={config.name + " ontkoppelen?"} confirmLabel="Ontkoppelen" danger onConfirm={() => void disconnect()}>
        <p>{config.copy.disconnect}</p>
      </ConfirmDialog>
    </li>
  );
}
