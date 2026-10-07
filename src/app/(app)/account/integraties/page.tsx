"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RefreshCw, X } from "lucide-react";
import { PageHeading, IconButton } from "@/components/ui";
import { BrandIcon, type Brand } from "@/components/brand-icon";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import { CALENDAR_CARD, GMAIL_CARD, GoogleIntegrationCard } from "@/components/account/google-integration-card";
import { isBrowserDemo } from "@/lib/demo";

type Connection = {
  provider: string;
  display_name: string | null;
  status: string;
  scopes?: string[];
  last_synced_at?: string | null;
  expires_at?: string | null;
};
type Category = "communication" | "social" | "planning" | "reviews" | "commerce" | "ads";
type Integration = {
  id: string; // provider key in integration_connections, or a planned one
  brand: Brand;
  name: string;
  description: string;
  category: Category;
  provider?: string; // backend provider (aliases share one connection)
  planned?: boolean;
};

const CATEGORIES: [Category | "all", string][] = [
  ["all", "Alle integraties"],
  ["communication", "Communicatie"],
  ["social", "Social media"],
  ["planning", "Planning"],
  ["reviews", "Reviews"],
  ["commerce", "Webshop / Commerce"],
  ["ads", "Advertenties"],
];

const INTEGRATIONS: Integration[] = [
  { id: "whatsapp", brand: "whatsapp", name: "WhatsApp Business", description: "Ontvang en beantwoord WhatsApp-berichten in de Inbox.", category: "communication", provider: "whatsapp" },
  { id: "messenger", brand: "messenger", name: "Facebook Messenger", description: "Berichten aan je Facebook-pagina in de Inbox.", category: "communication", provider: "messenger" },
  { id: "gmail", brand: "gmail", name: "Gmail", description: "E-mails versturen en klantmails in de Inbox lezen.", category: "communication", provider: "gmail" },
  { id: "instagram", brand: "instagram", name: "Instagram", description: "Instagram-berichten (DM's) in de Inbox. Vereist een professioneel account.", category: "social", provider: "instagram" },
  { id: "linkedin", brand: "linkedin", name: "LinkedIn", description: "Posts plannen voor je bedrijfspagina.", category: "social", planned: true },
  { id: "google_calendar", brand: "google_calendar", name: "Google Agenda", description: "Je afspraken naast je Mavix-planning, in twee richtingen gesynchroniseerd.", category: "planning", provider: "google_calendar" },
  { id: "google_business", brand: "google_business", name: "Google Bedrijfsprofiel", description: "Je bedrijfslocatie en -gegevens op Google.", category: "reviews", provider: "google_business" },
  { id: "google_reviews", brand: "google_reviews", name: "Google Reviews", description: "Reviews lezen en beantwoorden. Werkt via je Google Bedrijfsprofiel.", category: "reviews", provider: "google_business" },
  { id: "shopify", brand: "shopify", name: "Shopify", description: "Producten en bestellingen gebruiken in je marketing.", category: "commerce", planned: true },
  { id: "google_ads", brand: "google_ads", name: "Google Ads", description: "Campagneresultaten en zoektermen bekijken.", category: "ads", planned: true },
  { id: "meta_ads", brand: "meta_ads", name: "Meta Ads", description: "Resultaten van Facebook- en Instagram-advertenties.", category: "ads", planned: true },
];

const SCOPE_LABEL: Record<string, string> = {
  openid: "Je Google-account herkennen",
  email: "Je e-mailadres bekijken",
  "https://www.googleapis.com/auth/gmail.send": "E-mails versturen namens jou",
  "https://www.googleapis.com/auth/gmail.readonly": "E-mails lezen voor de Inbox",
  "https://www.googleapis.com/auth/calendar.events": "Afspraken bekijken en wijzigen",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly": "Je lijst met agenda's bekijken",
  "https://www.googleapis.com/auth/business.manage": "Bedrijfsprofiel en reviews beheren",
  instagram_business_basic: "Basisgegevens van je Instagram-account",
  instagram_business_manage_messages: "Instagram-berichten lezen en beantwoorden",
  pages_show_list: "Je Facebook-pagina's bekijken",
  pages_manage_metadata: "Berichtmeldingen voor je pagina instellen",
  pages_messaging: "Messenger-berichten beantwoorden",
  whatsapp_business_messaging: "WhatsApp-berichten versturen en ontvangen",
  whatsapp_business_management: "Je WhatsApp Business-account beheren",
};
const GMAIL_READ = "https://www.googleapis.com/auth/gmail.readonly";
const NOTICES: Record<string, string> = {
  "connected=instagram": "Instagram is verbonden. Nieuwe berichten verschijnen in de Inbox.",
  "connected=messenger": "Messenger is verbonden. Nieuwe berichten verschijnen in de Inbox.",
  "connected=gmail": "Gmail is gekoppeld. Je klantmails verschijnen zo in de Inbox.",
  "error=offline_access": "Google gaf geen blijvende toegang. Koppel opnieuw; trek zo nodig eerst de toegang van Mavix in je Google-account in.",
  "error=expired": "De koppelpoging is verlopen of al gebruikt. Probeer het opnieuw.",
  "error=failed": "Koppelen is niet gelukt. Probeer het later opnieuw.",
  "select=messenger": "Kies welke Facebook-pagina je wilt koppelen (via Beheren bij Facebook Messenger).",
  "error=denied": "Je hebt geen toestemming gegeven. Er is niets gekoppeld.",
  "error=permission": "Niet alle benodigde toestemmingen zijn gegeven. Verbind opnieuw en sta alle gevraagde toegang toe.",
  "error=no_pages": "Er is geen Facebook-pagina gevonden waarop je berichten mag beheren.",
};

type State = "connected" | "disconnected" | "reconnect" | "permission" | "selection" | "error" | "planned";
const STATE_TEXT: Record<State, string> = {
  connected: "Verbonden",
  disconnected: "Niet verbonden",
  reconnect: "Opnieuw verbinden",
  permission: "Nieuwe toestemming vereist",
  selection: "Keuze nodig",
  error: "Fout bij koppeling",
  planned: "Binnenkort",
};

function stateOf(item: Integration, c?: Connection): State {
  if (item.planned) return "planned";
  if (!c || c.status === "disconnected") return "disconnected";
  if (c.status === "reconnect_required") return "reconnect";
  if (c.status === "permission_missing") return "permission";
  if (c.status === "selection_required") return "selection";
  if (c.status !== "connected") return "error";
  if (item.provider === "gmail" && !(c.scopes || []).includes(GMAIL_READ)) return "permission";
  return "connected";
}

const dateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("nl-NL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function IntegrationsPage() {
  const [demo, setDemo] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [category, setCategory] = useState<Category | "all">("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [manage, setManage] = useState<Integration | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locations, setLocations] = useState<{ id: string; account: string; name: string }[] | null>(null);
  const [pages, setPages] = useState<{ id: string; name: string }[] | null>(null);
  const [wa, setWa] = useState({ phoneNumberId: "", wabaId: "", token: "" });
  const [test, setTest] = useState({ to: "", subject: "", body: "", result: "" });

  const load = useCallback(async () => {
    const r = await fetch("/api/integrations");
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    setConnections(d.connections);
    setLoaded(true);
    return d.connections as Connection[];
  }, []);

  useEffect(() => {
    const isDemo = isBrowserDemo();
    setDemo(isDemo);
    const q = new URLSearchParams(window.location.search);
    const key = [...q.entries()].map(([k, v]) => k + "=" + v).find((k) => NOTICES[k]);
    if (key) setNotice(NOTICES[key]);
    if (q.toString()) window.history.replaceState(null, "", "/account/integraties");
    if (isDemo) {
      setLoaded(true);
      return;
    }
    void load()
      .then((list) => {
        if (list.some((c) => c.provider === "messenger" && c.status === "selection_required") && q.get("select") === "messenger")
          setManage(INTEGRATIONS.find((i) => i.id === "messenger")!);
      })
      .catch((e) => {
        setError(e.message);
        setLoaded(true);
      });
  }, [load]);

  const conn = (item: Integration) => connections.find((c) => c.provider === item.provider);

  async function call(provider: string, act: string, body?: object) {
    setBusy(true);
    setError("");
    try {
      const get = act === "locations" || act === "pages";
      const r = await fetch(`/api/integrations/${provider}/${act}`, {
        method: get ? "GET" : "POST",
        ...(!get ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) } : {}),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (d.url) window.location.assign(d.url);
      await load();
      return d;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Probeer het opnieuw.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  function open(item: Integration) {
    setError("");
    setLocations(null);
    setPages(null);
    setManage(item);
    const c = conn(item);
    if (item.provider === "messenger" && c?.status === "selection_required") void call("messenger", "pages").then((d) => d && setPages(d.pages));
  }

  async function connectWhatsApp(e: FormEvent) {
    e.preventDefault();
    const d = await call("whatsapp", "connect", wa);
    setWa({ phoneNumberId: "", wabaId: "", token: "" }); // never keep the token in the page
    if (d) setNotice("WhatsApp is verbonden. Nieuwe berichten verschijnen in de Inbox.");
  }

  async function sendTest(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/integrations/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: test.to, subject: test.subject, body: test.body }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setTest({ ...test, result: "Verzonden. Gmail-bericht-ID: " + d.id });
    } catch (err) {
      setTest({ ...test, result: err instanceof Error ? err.message : "Versturen is niet gelukt." });
    } finally {
      setBusy(false);
    }
  }

  const visible = INTEGRATIONS.filter((i) => category === "all" || i.category === category);
  const m = manage;
  const mc = m ? conn(m) : undefined;
  const ms = m ? stateOf(m, mc) : "disconnected";

  return (
    <div className="int">
      <PageHeading eyebrow="Account" title="Integraties" description="Koppel je kanalen en tools. Je geeft per dienst zelf toestemming." />
      {notice && (
        <p role="status" className="int-notice">
          {notice}
          <IconButton label="Melding sluiten" onClick={() => setNotice("")}>
            <X size={14} />
          </IconButton>
        </p>
      )}
      {demo && <p className="int-notice">In de testmodus kun je geen integraties koppelen. Je ziet hier welke diensten beschikbaar zijn.</p>}
      {error && !manage && (
        <p role="alert" className="int-error">
          {error}
        </p>
      )}

      <div className="int-tabs" role="tablist" aria-label="Categorie">
        {CATEGORIES.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={category === id} onClick={() => setCategory(id)}>
            {label}
          </button>
        ))}
      </div>

      <ul className="int-list ui-card">
        {visible.map((item) => {
          if (item.id === "google_calendar" || item.id === "gmail")
            return <GoogleIntegrationCard key={item.id} config={item.id === "gmail" ? GMAIL_CARD : CALENDAR_CARD} demo={demo} onNotice={setNotice} />;
          const c = conn(item);
          const state = loaded ? stateOf(item, c) : item.planned ? "planned" : "disconnected";
          const linked = !item.planned && state !== "disconnected";
          return (
            <li key={item.id} className="int-row">
              <span className="int-logo">
                <BrandIcon brand={item.brand} size={24} />
              </span>
              <div className="int-info">
                <strong>{item.name}</strong>
                <p>{item.description}</p>
                {linked && c?.display_name && <small>{c.display_name}</small>}
              </div>
              <span className={"int-state is-" + state}>{STATE_TEXT[state]}</span>
              {item.planned ? (
                <button type="button" className="button secondary" disabled>
                  Binnenkort
                </button>
              ) : linked ? (
                <button type="button" className="button secondary" onClick={() => open(item)} disabled={demo}>
                  Beheren
                </button>
              ) : (
                <button
                  type="button"
                  className="button primary"
                  disabled={demo || busy}
                  onClick={() => (item.provider === "whatsapp" ? open(item) : void call(item.provider!, "connect"))}
                >
                  Koppelen
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {m && (
        <>
          <div className="int-scrim" onClick={() => setManage(null)} aria-hidden="true" />
          <div className="int-modal" role="dialog" aria-modal="true" aria-labelledby="int-modal-title">
            <header>
              <BrandIcon brand={m.brand} size={26} />
              <div>
                <h2 id="int-modal-title">{m.name}</h2>
                <span className={"int-state is-" + ms}>{STATE_TEXT[ms]}</span>
              </div>
              <IconButton label="Sluiten" onClick={() => setManage(null)}>
                <X size={16} />
              </IconButton>
            </header>
            <div className="int-modal-body">
              {error && (
                <p role="alert" className="int-error">
                  {error}
                </p>
              )}
              {mc && ms !== "disconnected" && (
                <dl className="int-details">
                  <dt>Account</dt>
                  <dd>{mc.display_name || "—"}</dd>
                  <dt>Status</dt>
                  <dd>{STATE_TEXT[ms]}</dd>
                  <dt>Laatst gesynchroniseerd</dt>
                  <dd>{dateTime(mc.last_synced_at)}</dd>
                  {mc.expires_at && m.provider === "instagram" && (
                    <>
                      <dt>Toegang geldig tot</dt>
                      <dd>{dateTime(mc.expires_at)} (wordt automatisch verlengd)</dd>
                    </>
                  )}
                  <dt>Rechten</dt>
                  <dd>
                    {mc.scopes?.length ? (
                      <ul className="int-scopes">
                        {mc.scopes
                          .filter((s) => SCOPE_LABEL[s] && s !== "openid")
                          .map((s) => (
                            <li key={s}>{SCOPE_LABEL[s]}</li>
                          ))}
                      </ul>
                    ) : (
                      "—"
                    )}
                  </dd>
                </dl>
              )}
              {m.id === "google_reviews" && <p className="int-hint">Google Reviews gebruikt dezelfde koppeling als Google Bedrijfsprofiel.</p>}
              {m.provider === "gmail" && ms === "permission" && (
                <p className="int-hint">Mavix heeft leestoegang nodig om klantmails in de Inbox te tonen. Versturen blijft werken.</p>
              )}
              {m.provider === "gmail" && ms === "connected" && <p className="int-hint">De Inbox haalt e-mail ongeveer elke minuut op (geen realtime).</p>}

              {m.provider === "google_business" && mc && (
                <div className="int-section">
                  <h3>Bedrijfslocatie</h3>
                  {locations === null ? (
                    <button type="button" className="button secondary" disabled={busy} onClick={() => void call("google_business", "locations").then((d) => d && setLocations(d.locations))}>
                      Locatie kiezen
                    </button>
                  ) : locations.length ? (
                    <div className="int-choices">
                      {locations.map((l) => (
                        <button key={l.account + l.id} type="button" className="button secondary" disabled={busy} onClick={() => void call("google_business", "select", { location: l.id, account: l.account }).then(() => setLocations(null))}>
                          {l.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="int-hint">Geen locaties gevonden voor dit Google-account.</p>
                  )}
                </div>
              )}

              {m.provider === "messenger" && pages && (
                <div className="int-section">
                  <h3>Kies een Facebook-pagina</h3>
                  {pages.length ? (
                    <div className="int-choices">
                      {pages.map((p) => (
                        <button key={p.id} type="button" className="button secondary" disabled={busy} onClick={() => void call("messenger", "select", { page: p.id }).then((d) => d && (setPages(null), setNotice("Messenger is verbonden.")))}>
                          {p.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="int-hint">Er is geen pagina gevonden waarop je berichten mag beheren.</p>
                  )}
                </div>
              )}

              {m.provider === "whatsapp" && (
                <form className="int-section int-form" onSubmit={(e) => void connectWhatsApp(e)}>
                  <h3>{ms === "disconnected" ? "WhatsApp koppelen" : "Nieuwe gegevens invoeren"}</h3>
                  <p className="int-hint">
                    Gebruik de gegevens uit Meta Business Suite (WhatsApp Manager) en een systeemgebruiker-token. Het token wordt versleuteld opgeslagen en is
                    daarna niet meer zichtbaar.
                  </p>
                  <label>
                    Phone Number ID
                    <input inputMode="numeric" required pattern="\d{5,30}" value={wa.phoneNumberId} onChange={(e) => setWa({ ...wa, phoneNumberId: e.target.value.trim() })} />
                  </label>
                  <label>
                    WhatsApp Business Account ID
                    <input inputMode="numeric" required pattern="\d{5,30}" value={wa.wabaId} onChange={(e) => setWa({ ...wa, wabaId: e.target.value.trim() })} />
                  </label>
                  <label>
                    Systeemgebruiker-token
                    <input type="password" autoComplete="off" required minLength={20} value={wa.token} onChange={(e) => setWa({ ...wa, token: e.target.value.trim() })} />
                  </label>
                  <button type="submit" className="button primary" disabled={busy}>
                    {busy ? "Controleren…" : "WhatsApp koppelen"}
                  </button>
                </form>
              )}

              {m.provider === "gmail" && mc?.status === "connected" && (
                <details className="int-section">
                  <summary>Testmail versturen</summary>
                  <form className="int-form" onSubmit={(e) => void sendTest(e)}>
                    <label>
                      Aan
                      <input type="email" required value={test.to} onChange={(e) => setTest({ ...test, to: e.target.value })} />
                    </label>
                    <label>
                      Onderwerp
                      <input required maxLength={200} value={test.subject} onChange={(e) => setTest({ ...test, subject: e.target.value })} />
                    </label>
                    <label>
                      Bericht
                      <textarea required maxLength={5000} rows={3} value={test.body} onChange={(e) => setTest({ ...test, body: e.target.value })} />
                    </label>
                    <button type="submit" className="button secondary" disabled={busy}>
                      Verstuur testmail
                    </button>
                    {test.result && <p role="status">{test.result}</p>}
                  </form>
                </details>
              )}
            </div>
            <footer>
              {mc && ms !== "disconnected" && (
                <button type="button" className="button danger-text" onClick={() => setConfirmRemove(true)} disabled={busy}>
                  Verbinding verwijderen
                </button>
              )}
              {m.provider !== "whatsapp" && (
                <button type="button" className="button primary" disabled={busy} onClick={() => void call(m.provider!, "connect")}>
                  <RefreshCw size={14} />
                  {ms === "permission" ? "Toestemming geven" : ms === "disconnected" ? "Koppelen" : "Opnieuw verbinden"}
                </button>
              )}
            </footer>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title={"Verbinding met " + (m?.name || "") + " verwijderen?"}
        confirmLabel="Verwijderen"
        danger
        onConfirm={async () => {
          if (!m?.provider) return;
          setConfirmRemove(false);
          if (await call(m.provider, "disconnect")) {
            setManage(null);
            setNotice(m.name + " is ontkoppeld.");
          }
        }}
      >
        <p>Mavix verwijdert de opgeslagen toegang. Je kunt later opnieuw koppelen.</p>
      </ConfirmDialog>
    </div>
  );
}
