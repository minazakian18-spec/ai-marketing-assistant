"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Search, ShieldCheck } from "lucide-react";
import { PageHeading, EmptyState, Badge } from "@/components/ui";
import { ApplicationsAdmin } from "@/components/admin/applications-admin";
import { WorkspaceDetail } from "@/components/admin/workspace-detail";
import { PLANS } from "@/lib/plans";

// Mavix administration (public.platform_admins only; the server refuses
// everyone else). Overview first; details of a customer (subscription,
// price, tokens, invoices, events and access) open after a click.
type Row = {
  id: string;
  name: string;
  status: "pending" | "approved" | "suspended";
  aiLimit: number | null;
  priceCents?: number | null;
  plan?: string | null;
  unpaidInvoices?: number;
  createdAt: string;
  ownerEmail: string | null;
  tokensThisMonth: number;
  costUsdThisMonth?: number;
  billing?: string;
  integrations?: { connected: string[]; attention: string[] };
};
const BILLING: Record<string, string> = { beta: "Beta", active: "Actief", trialing: "Proefperiode", past_due: "Betaling mislukt", incomplete: "Niet afgerond", canceled: "Opgezegd" };
const LABEL = { pending: "Wacht op goedkeuring", approved: "Toegang", suspended: "Gepauzeerd" } as const;
const TONE = { pending: "warn", approved: "success", suspended: "neutral" } as const;
const fmt = new Intl.NumberFormat("nl-NL");
const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function AdminPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [diagnostics, setDiagnostics] = useState<{ event: string; at: string }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "attention" | "unpaid">("all");
  const load = useCallback(async () => {
    const r = await fetch("/api/admin/workspaces", { cache: "no-store" });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(r.status === 403 ? "Deze pagina is alleen voor Mavix-beheerders." : body.error || "Laden is niet gelukt.");
      setRows([]);
      return;
    }
    setRows(body.workspaces);
    setDiagnostics(body.webhookDiagnostics || []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const price = (r: Row) => (r.priceCents != null ? r.priceCents / 100 : r.plan && PLANS[r.plan as keyof typeof PLANS] ? PLANS[r.plan as keyof typeof PLANS].monthlyPrice : 0);
  const stats = useMemo(() => {
    const list = rows || [];
    return {
      customers: list.filter((r) => r.status === "approved").length,
      pending: list.filter((r) => r.status === "pending").length,
      unpaid: list.reduce((s, r) => s + (r.unpaidInvoices || 0), 0),
      mrr: list.filter((r) => r.status === "approved" && r.billing !== "beta").reduce((s, r) => s + price(r), 0),
    };
  }, [rows]);
  const shown = (rows || []).filter((r) => {
    const q = query.trim().toLowerCase();
    if (q && !(r.name + " " + (r.ownerEmail || "")).toLowerCase().includes(q)) return false;
    if (filter === "attention") return r.status === "pending" || !!r.integrations?.attention.length || r.billing === "past_due";
    if (filter === "unpaid") return (r.unpaidInvoices || 0) > 0;
    return true;
  });

  return (
    <div className="admin-page adm">
      <PageHeading title="Beheer" description="Demo's, klanten, abonnementen en facturen op één plek." />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {!error && rows && (
        <ul className="adm-stats">
          <li>
            <span>Actieve klanten</span>
            <strong>{stats.customers}</strong>
          </li>
          <li>
            <span>Wacht op goedkeuring</span>
            <strong>{stats.pending}</strong>
          </li>
          <li className={stats.unpaid ? "is-warn" : ""}>
            <span>Openstaande facturen</span>
            <strong>{stats.unpaid}</strong>
          </li>
          <li>
            <span>Omzet per maand</span>
            <strong>{euro.format(stats.mrr)}</strong>
          </li>
        </ul>
      )}

      {!error && <ApplicationsAdmin />}

      {rows === null ? (
        <div className="admin-skeleton" aria-busy="true" aria-label="Laden" />
      ) : !rows.length ? (
        !error && <EmptyState icon={<ShieldCheck size={18} />} title="Nog geen klanten" />
      ) : (
        <section className="ui-card admin-card">
          <header className="admin-card-head adm-list-head">
            <h2>Klanten</h2>
            <div className="adm-filters">
              <label className="adm-search">
                <Search size={15} aria-hidden="true" />
                <span className="sr-only">Zoek een klant</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek op naam of e-mail" />
              </label>
              <select aria-label="Filter" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
                <option value="all">Alle klanten</option>
                <option value="attention">Heeft aandacht nodig</option>
                <option value="unpaid">Factuur open</option>
              </select>
            </div>
          </header>
          <ul className="adm-customers">
            {shown.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setSelected(r.id)}>
                  <span className="adm-avatar" aria-hidden="true">
                    {r.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="adm-who">
                    <strong>{r.name}</strong>
                    <small>{r.ownerEmail || "Eigenaar onbekend"}</small>
                  </span>
                  <span className="adm-plan">
                    {r.plan ? PLANS[r.plan as keyof typeof PLANS]?.name || r.plan : "Beta"}
                    <small>
                      {BILLING[r.billing || "beta"]}
                      {price(r) ? " · " + euro.format(price(r)) + "/mnd" : ""}
                    </small>
                  </span>
                  <span className="adm-usage">
                    {fmt.format(r.tokensThisMonth)}
                    <small>tokens deze maand</small>
                  </span>
                  <span className="adm-badges">
                    <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
                    {(r.unpaidInvoices || 0) > 0 && <Badge tone="warn">{r.unpaidInvoices} open</Badge>}
                    {!!r.integrations?.attention.length && <Badge tone="warn">Koppeling</Badge>}
                  </span>
                  <ChevronRight size={16} aria-hidden="true" className="adm-chevron" />
                </button>
              </li>
            ))}
            {!shown.length && <li className="adm-none">Geen klanten gevonden.</li>}
          </ul>
        </section>
      )}

      {!error && rows !== null && (
        <details className="ui-card admin-card adm-diag">
          <summary>Meta-webhooks (diagnose)</summary>
          {diagnostics.length ? (
            <ul className="admin-audit">
              {diagnostics.map((d, i) => (
                <li key={i}>
                  <time dateTime={d.at}>{new Date(d.at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "medium" })}</time>
                  <code>{d.event}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nog geen webhook van Meta ontvangen sinds de diagnose actief is.</p>
          )}
        </details>
      )}

      {selected && <WorkspaceDetail id={selected} onClose={() => setSelected(null)} onChanged={() => void load()} />}
    </div>
  );
}
