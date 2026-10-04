"use client";
import { useEffect, useState } from "react";
import { PageHeading } from "@/components/ui";

type Connection = { provider: string; display_name: string; status: string; scopes?: string[]; last_synced_at?: string | null };
const GMAIL_READ = "https://www.googleapis.com/auth/gmail.readonly";
const statusLabel = (s?: string) =>
  ({
    connected: "Verbonden",
    selection_required: "Kies een bedrijfslocatie",
    reconnect_required: "Opnieuw verbinden vereist",
    permission_missing: "Nieuwe toestemming vereist",
    error: "Fout bij koppeling",
  } as Record<string, string>)[s || ""] || "Niet gekoppeld";

const CARDS: [string, string, string][] = [
  ["google_business", "Google Business Profile", "Reviews lezen en beantwoorden."],
  ["gmail", "Gmail", "E-mails versturen en klantmails in de Inbox lezen."],
  ["google_calendar", "Google Calendar", "Je agenda in de Mavix-kalender."],
  ["instagram", "Instagram", "Instagram-berichten (DM's) in de Inbox. Vereist een professioneel account."],
  ["messenger", "Facebook Messenger", "Berichten aan je Facebook-pagina in de Inbox."],
  ["whatsapp", "WhatsApp Business", "WhatsApp Cloud API-berichten in de Inbox."],
];
const NOTICES: Record<string, string> = {
  "connected=instagram": "Instagram is verbonden. Nieuwe berichten verschijnen in de Inbox.",
  "connected=messenger": "Messenger is verbonden. Nieuwe berichten verschijnen in de Inbox.",
  "connected=gmail": "Gmail is verbonden.",
  "select=messenger": "Kies hieronder welke Facebook-pagina je wilt koppelen.",
  "error=denied": "Je hebt geen toestemming gegeven. Er is niets gekoppeld.",
  "error=permission": "Niet alle benodigde toestemmingen zijn gegeven. Verbind opnieuw en sta alle gevraagde toegang toe.",
  "error=no_pages": "Er is geen Facebook-pagina gevonden waarop je berichten mag beheren.",
};

function stateOf(provider: string, c?: Connection) {
  if (!c || c.status === "disconnected") return "disconnected";
  if (provider === "gmail" && c.status === "connected" && !(c.scopes || []).includes(GMAIL_READ)) return "permission_missing";
  if (provider === "messenger" && c.status === "selection_required") return "page_required";
  return c.status;
}

export default function IntegrationsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [locations, setLocations] = useState<{ id: string; account: string; name: string }[]>([]);
  const [pages, setPages] = useState<{ id: string; name: string }[]>([]);
  const [testTo, setTestTo] = useState(""), [testSubject, setTestSubject] = useState(""), [testBody, setTestBody] = useState("");
  const [testResult, setTestResult] = useState(""), [sending, setSending] = useState(false);
  const [wa, setWa] = useState({ phoneNumberId: "", wabaId: "", token: "" });
  const [waOpen, setWaOpen] = useState(false), [waBusy, setWaBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/integrations");
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    setConnections(d.connections);
    return d.connections as Connection[];
  }
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const key = [...q.entries()].map(([k, v]) => k + "=" + v).find((k) => NOTICES[k]);
    if (key) setNotice(NOTICES[key]);
    void load()
      .then((list) => {
        if (list.some((c) => c.provider === "messenger" && c.status === "selection_required")) void action("messenger", "pages");
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function action(provider: string, act: string, body: object = {}) {
    try {
      setError("");
      const get = act === "locations" || act === "pages";
      const r = await fetch(`/api/integrations/${provider}/${act}`, {
        method: get ? "GET" : "POST",
        ...(!get ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (d.url) window.location.assign(d.url);
      if (d.locations) setLocations(d.locations);
      if (d.pages) setPages(d.pages);
      if (act === "select" && provider === "messenger") {
        setPages([]);
        setNotice("Messenger is verbonden. Nieuwe berichten verschijnen in de Inbox.");
      }
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Probeer opnieuw.");
      return false;
    }
  }

  async function sendTestEmail() {
    setSending(true);
    setTestResult("");
    try {
      const r = await fetch("/api/integrations/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo, subject: testSubject, body: testBody }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setTestResult("Verzonden. Gmail-bericht-ID: " + d.id);
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : "Versturen is niet gelukt.");
    } finally {
      setSending(false);
    }
  }

  async function connectWhatsApp() {
    setWaBusy(true);
    const ok = await action("whatsapp", "connect", wa);
    setWaBusy(false);
    // The token is never kept in the browser after submitting.
    setWa({ phoneNumberId: "", wabaId: "", token: "" });
    if (ok) {
      setWaOpen(false);
      setNotice("WhatsApp is verbonden. Nieuwe berichten verschijnen in de Inbox.");
    }
  }

  return (
    <>
      <PageHeading eyebrow="ACCOUNT" title="Integraties" description="Geef per dienst expliciet toestemming voor toegang." />
      {notice && <p role="status" className="integration-notice">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      <div className="integration-grid">
        {CARDS.map(([provider, label, purpose]) => {
          const c = connections.find((c) => c.provider === provider);
          const state = stateOf(provider, c);
          const linked = state !== "disconnected";
          return (
            <section className="panel integration-card" key={provider}>
              <h2>{label}</h2>
              <p>{purpose}</p>
              <p>{c?.display_name && linked ? "Verbonden als: " + c.display_name : "Geen account gekoppeld"}</p>
              <p className="integration-status" data-status={state}>
                {state === "page_required" ? "Kies een Facebook-pagina" : statusLabel(state)}
              </p>
              {provider === "gmail" && state === "permission_missing" && (
                <p className="integration-hint">Mavix heeft leestoegang nodig om klantmails in de Inbox te tonen. Versturen blijft werken.</p>
              )}
              {provider === "gmail" && state === "connected" && (
                <p className="integration-hint">De Inbox haalt e-mail ongeveer elke minuut op (geen realtime).</p>
              )}
              {provider === "whatsapp" ? (
                <button className="button primary" onClick={() => setWaOpen(!waOpen)} aria-expanded={waOpen}>
                  {linked ? "Opnieuw verbinden" : "Verbinden"}
                </button>
              ) : (
                <button className="button primary" onClick={() => void action(provider, "connect")}>
                  {state === "permission_missing" ? "Toestemming geven" : linked ? "Opnieuw verbinden" : "Verbinden"}
                </button>
              )}
              {linked && (
                <button className="button secondary" onClick={() => void action(provider, "disconnect")}>
                  Ontkoppelen
                </button>
              )}
              {provider === "google_business" && c && (
                <button className="button secondary" onClick={() => void action(provider, "locations")}>
                  Bedrijfslocatie kiezen
                </button>
              )}
              {provider === "messenger" && state === "page_required" && pages.length > 0 && (
                <div className="integration-choices" role="group" aria-label="Facebook-pagina">
                  {pages.map((p) => (
                    <button key={p.id} className="button secondary" onClick={() => void action("messenger", "select", { page: p.id })}>
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
              {provider === "whatsapp" && waOpen && (
                <form
                  className="integration-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void connectWhatsApp();
                  }}
                >
                  <p className="integration-hint">
                    Gebruik de gegevens uit Meta Business Suite → WhatsApp Manager / App Dashboard. Het token wordt versleuteld opgeslagen en is
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
                  <button type="submit" className="button primary" disabled={waBusy}>
                    {waBusy ? "Controleren…" : "WhatsApp koppelen"}
                  </button>
                </form>
              )}
              {provider === "gmail" && c?.status === "connected" && (
                <div className="gmail-test-email">
                  <label>
                    Aan
                    <input type="email" required value={testTo} onChange={(e) => setTestTo(e.target.value)} />
                  </label>
                  <label>
                    Onderwerp
                    <input required maxLength={200} value={testSubject} onChange={(e) => setTestSubject(e.target.value)} />
                  </label>
                  <label>
                    Bericht
                    <textarea required maxLength={5000} rows={3} value={testBody} onChange={(e) => setTestBody(e.target.value)} />
                  </label>
                  <button type="button" className="button secondary" disabled={sending || !testTo || !testSubject || !testBody} onClick={() => void sendTestEmail()}>
                    {sending ? "Bezig met versturen…" : "Verstuur testmail"}
                  </button>
                  {testResult && <p role="status">{testResult}</p>}
                </div>
              )}
            </section>
          );
        })}
      </div>
      {locations.map((l) => (
        <button key={l.account + l.id} className="button secondary" onClick={() => void action("google_business", "select", { location: l.id, account: l.account })}>
          {l.name}
        </button>
      ))}
    </>
  );
}
