"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui";
import { PLAN_IDS, PLANS } from "@/lib/plans";
import { BRAND_LABEL, type Brand } from "@/components/brand-icon";

// One customer in /beheer: subscription and price, AI tokens, invoices
// (marked paid by hand), integrations, team and recent events.
// Server: /api/admin/workspaces/[id], /api/admin/workspaces (PATCH), /api/admin/invoices.
type Invoice = { id: string; period: string; amountCents: number; status: "open" | "paid" | "overdue" | "void"; paidAt: string | null; note: string | null };
type Detail = {
  id: string;
  name: string;
  status: "pending" | "approved" | "suspended";
  createdAt: string;
  aiLimit: number | null;
  priceCents: number | null;
  note: string;
  subscription: { plan: string | null; state: string; interval: string | null; periodEnd: string | null; viaStripe: boolean };
  usage: { tokens: number; costUsd: number; requests: number };
  members: { email: string; role: string; lastSignIn: string | null }[];
  integrations: { provider: string; status: string; name: string | null; updatedAt: string }[];
  invoices: Invoice[] | null;
  events: { event: string; at: string }[];
};
const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const n = new Intl.NumberFormat("nl-NL");
const day = (iso: string) => new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
const month = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
const INVOICE: Record<Invoice["status"], [string, "success" | "warn" | "neutral" | "accent"]> = { paid: ["Betaald", "success"], open: ["Open", "warn"], overdue: ["Te laat", "warn"], void: ["Vervallen", "neutral"] };
const ROLE: Record<string, string> = { OWNER: "Eigenaar", ADMIN: "Beheerder", MEMBER: "Lid" };
const STATE: Record<string, string> = { beta: "Beta (geen betaling)", active: "Actief", trialing: "Proefperiode", past_due: "Betaling mislukt", incomplete: "Niet afgerond", canceled: "Opgezegd" };
const CONN: Record<string, string> = { connected: "Verbonden", reconnect_required: "Opnieuw koppelen", permission_missing: "Toestemming nodig", selection_required: "Keuze nodig", error: "Fout", disconnected: "Niet verbonden" };
const EVENT: Record<string, string> = {
  integration_authorized: "Koppeling gemaakt",
  integration_disconnected: "Koppeling verbroken",
  ai_limit_changed: "AI-limiet aangepast",
  price_changed: "Bedrag aangepast",
  invoice_created: "Factuur aangemaakt",
  invoice_paid: "Factuur betaald",
  invoice_open: "Factuur weer open",
  invoice_overdue: "Factuur te laat",
  invoice_void: "Factuur vervallen",
  invoice_deleted: "Factuur verwijderd",
  beta_access_approved: "Toegang goedgekeurd",
  beta_access_suspended: "Toegang gepauzeerd",
  beta_access_pending: "Terug naar wachten",
};
const eventLabel = (e: string) => EVENT[e] || (e.startsWith("plan_set_") ? "Abonnement gezet op " + (PLANS[e.slice(9) as keyof typeof PLANS]?.name || "beta") : e.replace(/_/g, " "));
const brandName = (p: string) => BRAND_LABEL[p as Brand] || p.replace(/_/g, " ");
const thisMonth = () => new Date().toISOString().slice(0, 7);

export function WorkspaceDetail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState<"abonnement" | "facturen" | "activiteit">("abonnement");
  const [form, setForm] = useState({ plan: "", price: "", tokens: "", note: "" });
  const [invoice, setInvoice] = useState({ period: thisMonth(), amount: "" });

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/workspaces/" + id, { cache: "no-store" });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) return setError(b.error || "Laden is niet gelukt.");
    setD(b);
    setForm({ plan: b.subscription.plan || "", price: b.priceCents == null ? "" : String(b.priceCents / 100).replace(".", ","), tokens: b.aiLimit == null ? "" : String(b.aiLimit), note: b.note || "" });
    setInvoice((v) => ({ ...v, amount: v.amount || (b.priceCents != null ? String(b.priceCents / 100).replace(".", ",") : "") }));
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  async function send(url: string, method: string, body: object, key: string) {
    setBusy(key);
    setError("");
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const b = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) {
      setError(b.error || "Opslaan is niet gelukt.");
      return false;
    }
    await load();
    onChanged();
    return true;
  }
  const cents = (v: string) => (v.trim() === "" ? null : Math.round(Number(v.replace(/\./g, "").replace(",", ".")) * 100));

  function saveSubscription() {
    if (!d) return;
    const patch: Record<string, unknown> = { id };
    const price = cents(form.price);
    const tokens = form.tokens.trim() === "" ? null : Math.round(Number(form.tokens));
    if ((form.plan || null) !== d.subscription.plan && !d.subscription.viaStripe) patch.plan = form.plan || null;
    if (price !== d.priceCents && (price === null || Number.isFinite(price))) patch.priceCents = price;
    if (tokens !== d.aiLimit && (tokens === null || Number.isFinite(tokens))) patch.aiLimit = tokens;
    if (form.note !== d.note) patch.note = form.note;
    if (Object.keys(patch).length === 1) return setError("Er is niets gewijzigd.");
    void send("/api/admin/workspaces", "PATCH", patch, "save");
  }

  const planPrice = form.plan ? PLANS[form.plan as keyof typeof PLANS]?.monthlyPrice : undefined;
  const open = d?.invoices?.filter((i) => i.status === "open" || i.status === "overdue") || [];

  return (
    <>
      <div className="adm-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="adm-drawer" role="dialog" aria-modal="true" aria-labelledby="adm-detail-title">
        <header className="adm-drawer-head">
          <div>
            <h2 id="adm-detail-title">{d?.name || "Laden…"}</h2>
            {d && (
              <p>
                Klant sinds {day(d.createdAt)} · {STATE[d.subscription.state] || d.subscription.state}
                {open.length ? ` · ${open.length} factuur open` : ""}
              </p>
            )}
          </div>
          <button type="button" className="adm-close" aria-label="Sluiten" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {d && (
          <>
            <div className="adm-access">
              <Badge tone={d.status === "approved" ? "success" : d.status === "pending" ? "warn" : "neutral"}>{d.status === "approved" ? "Toegang" : d.status === "pending" ? "Wacht op goedkeuring" : "Gepauzeerd"}</Badge>
              {d.status !== "approved" ? (
                <button type="button" className="button primary" disabled={!!busy} onClick={() => void send("/api/admin/workspaces", "PATCH", { id, status: "approved" }, "status")}>
                  Toegang geven
                </button>
              ) : (
                <button type="button" className="button secondary" disabled={!!busy} onClick={() => void send("/api/admin/workspaces", "PATCH", { id, status: "suspended" }, "status")}>
                  Pauzeren
                </button>
              )}
            </div>

            <div className="adm-tabs" role="tablist">
              {(["abonnement", "facturen", "activiteit"] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                  {t === "abonnement" ? "Abonnement" : t === "facturen" ? `Facturen${open.length ? ` (${open.length})` : ""}` : "Activiteit en toegang"}
                </button>
              ))}
            </div>

            {tab === "abonnement" && (
              <section className="adm-section">
                <div className="adm-fields">
                  <label>
                    Abonnement
                    <select value={form.plan} disabled={d.subscription.viaStripe} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
                      <option value="">Beta (geen abonnement)</option>
                      {PLAN_IDS.map((p) => (
                        <option key={p} value={p}>
                          {PLANS[p].name}
                        </option>
                      ))}
                    </select>
                    {d.subscription.viaStripe && <small>Loopt via Stripe: wijzig het plan daar.</small>}
                  </label>
                  <label>
                    Bedrag per maand (€)
                    <input inputMode="decimal" placeholder={planPrice != null ? `Standaard € ${planPrice}` : "Standaard"} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                    <small>Leeg laten = de prijs van het abonnement.</small>
                  </label>
                  <label>
                    AI-tokens per maand
                    <input inputMode="numeric" placeholder="Standaard van het plan" value={form.tokens} onChange={(e) => setForm({ ...form, tokens: e.target.value.replace(/\D/g, "") })} />
                    <small>
                      Deze maand gebruikt: {n.format(d.usage.tokens)} tokens in {d.usage.requests} verzoeken (${d.usage.costUsd.toFixed(2)}).
                    </small>
                  </label>
                  <label className="adm-wide">
                    Interne notitie
                    <textarea rows={3} maxLength={2000} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Afspraken, korting, contactpersoon…" />
                  </label>
                </div>
                <div className="adm-actions">
                  <button type="button" className="button primary" disabled={!!busy} onClick={saveSubscription}>
                    {busy === "save" ? "Opslaan…" : "Wijzigingen opslaan"}
                  </button>
                </div>
              </section>
            )}

            {tab === "facturen" && (
              <section className="adm-section">
                {d.invoices === null ? (
                  <p className="muted">Facturen worden nog ingericht: de database-migratie moet nog worden toegepast.</p>
                ) : (
                  <>
                    <form
                      className="adm-invoice-new"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const a = cents(invoice.amount);
                        if (a === null || !Number.isFinite(a)) return setError("Vul een bedrag in.");
                        void send("/api/admin/invoices", "POST", { workspaceId: id, period: invoice.period, amountCents: a }, "invoice");
                      }}
                    >
                      <label>
                        Maand
                        <input type="month" value={invoice.period} onChange={(e) => setInvoice({ ...invoice, period: e.target.value })} required />
                      </label>
                      <label>
                        Bedrag (€)
                        <input inputMode="decimal" value={invoice.amount} onChange={(e) => setInvoice({ ...invoice, amount: e.target.value })} required />
                      </label>
                      <button type="submit" className="button secondary" disabled={!!busy}>
                        <Plus size={14} aria-hidden="true" /> Factuur toevoegen
                      </button>
                    </form>
                    {d.invoices.length ? (
                      <ul className="adm-invoices">
                        {d.invoices.map((i) => (
                          <li key={i.id} className={"is-" + i.status}>
                            <span className="adm-inv-period">{month(i.period)}</span>
                            <strong>{euro.format(i.amountCents / 100)}</strong>
                            <Badge tone={INVOICE[i.status][1]}>{INVOICE[i.status][0]}</Badge>
                            <small>{i.paidAt ? "Betaald op " + day(i.paidAt) : ""}</small>
                            <span className="adm-inv-actions">
                              {i.status !== "paid" ? (
                                <button type="button" className="button secondary" disabled={!!busy} onClick={() => void send("/api/admin/invoices", "PATCH", { id: i.id, status: "paid" }, i.id)}>
                                  <Check size={14} aria-hidden="true" /> Betaald
                                </button>
                              ) : (
                                <button type="button" className="button secondary" disabled={!!busy} onClick={() => void send("/api/admin/invoices", "PATCH", { id: i.id, status: "open" }, i.id)}>
                                  Niet betaald
                                </button>
                              )}
                              <select aria-label="Status" value={i.status} disabled={!!busy} onChange={(e) => void send("/api/admin/invoices", "PATCH", { id: i.id, status: e.target.value }, i.id)}>
                                <option value="open">Open</option>
                                <option value="paid">Betaald</option>
                                <option value="overdue">Te laat</option>
                                <option value="void">Vervallen</option>
                              </select>
                              <button
                                type="button"
                                className="adm-icon"
                                aria-label={"Factuur " + month(i.period) + " verwijderen"}
                                disabled={!!busy}
                                onClick={() => window.confirm("Deze factuur verwijderen?") && void send("/api/admin/invoices", "DELETE", { id: i.id }, i.id)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">Nog geen facturen. Voeg hierboven de eerste toe.</p>
                    )}
                  </>
                )}
              </section>
            )}

            {tab === "activiteit" && (
              <section className="adm-section adm-two">
                <div>
                  <h3>Toegang</h3>
                  <ul className="adm-list">
                    {d.members.map((m) => (
                      <li key={m.email}>
                        <strong>{m.email}</strong>
                        <small>
                          {ROLE[m.role] || m.role}
                          {m.lastSignIn ? " · laatst ingelogd " + day(m.lastSignIn) : " · nog nooit ingelogd"}
                        </small>
                      </li>
                    ))}
                  </ul>
                  <h3>Koppelingen</h3>
                  <ul className="adm-list">
                    {d.integrations.length ? (
                      d.integrations.map((c) => (
                        <li key={c.provider}>
                          <strong>{brandName(c.provider)}</strong>
                          <small>
                            {CONN[c.status] || c.status}
                            {c.name ? " · " + c.name : ""}
                          </small>
                        </li>
                      ))
                    ) : (
                      <li>
                        <small>Nog geen koppelingen.</small>
                      </li>
                    )}
                  </ul>
                </div>
                <div>
                  <h3>Recente gebeurtenissen</h3>
                  <ul className="adm-list adm-events">
                    {d.events.length ? (
                      d.events.map((e, i) => (
                        <li key={i}>
                          <strong>{eventLabel(e.event)}</strong>
                          <small>{new Date(e.at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}</small>
                        </li>
                      ))
                    ) : (
                      <li>
                        <small>Nog geen gebeurtenissen.</small>
                      </li>
                    )}
                  </ul>
                </div>
              </section>
            )}
          </>
        )}
      </aside>
    </>
  );
}
