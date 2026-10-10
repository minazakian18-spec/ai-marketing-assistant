"use client";
import { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { PageHeading, EmptyState, Badge } from "@/components/ui";

// Private beta administration for Mavix staff (public.platform_admins). The
// server refuses everyone else; this page only shows what the API returns.
type Row = { id: string; name: string; status: "pending" | "approved" | "suspended"; aiLimit: number | null; createdAt: string; ownerEmail: string | null; tokensThisMonth: number };
const LABEL = { pending: "Wacht op goedkeuring", approved: "Toegang", suspended: "Gepauzeerd" } as const;
const TONE = { pending: "warn", approved: "success", suspended: "neutral" } as const;
const fmt = new Intl.NumberFormat("nl-NL");

export default function AdminPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    const r = await fetch("/api/admin/workspaces", { cache: "no-store" });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(r.status === 403 ? "Deze pagina is alleen voor Mavix-beheerders." : body.error || "Laden is niet gelukt.");
      setRows([]);
      return;
    }
    setRows(body.workspaces);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
  }, [load]);
  async function change(id: string, patch: { status?: Row["status"]; aiLimit?: number | null }) {
    setBusy(id);
    setError("");
    const r = await fetch("/api/admin/workspaces", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...patch }) });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) setError(body.error || "Opslaan is niet gelukt.");
    await load();
    setBusy("");
  }
  const pending = rows?.filter((r) => r.status === "pending").length || 0;
  return (
    <div className="admin-page">
      <PageHeading eyebrow="Mavix-beheer" title="Besloten beta" description="Keur nieuwe werkruimtes goed, pauzeer toegang en stel per werkruimte een AI-limiet in." />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {rows === null ? (
        <div className="admin-skeleton" aria-busy="true" aria-label="Laden" />
      ) : !rows.length ? (
        !error && <EmptyState icon={<ShieldCheck size={18} />} title="Nog geen werkruimtes" />
      ) : (
        <section className="ui-card admin-card">
          <header className="admin-card-head">
            <h2>Werkruimtes</h2>
            {pending > 0 && <Badge tone="warn">{pending} wacht op goedkeuring</Badge>}
          </header>
          <div className="admin-table" role="table" aria-label="Werkruimtes">
            <div className="admin-row admin-row-head" role="row">
              <span role="columnheader">Werkruimte</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">AI deze maand</span>
              <span role="columnheader">Acties</span>
            </div>
            {rows.map((r) => (
              <div className="admin-row" role="row" key={r.id}>
                <span role="cell" className="admin-name">
                  <strong>{r.name}</strong>
                  <small>
                    {r.ownerEmail || "Eigenaar onbekend"} · {new Date(r.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
                  </small>
                </span>
                <span role="cell">
                  <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
                </span>
                <span role="cell" className="admin-usage">
                  {fmt.format(r.tokensThisMonth)} tokens
                  <label>
                    <span className="sr-only">AI-limiet voor {r.name}</span>
                    <input
                      type="number"
                      min={0}
                      step={100000}
                      placeholder="Standaard"
                      defaultValue={r.aiLimit ?? ""}
                      disabled={busy === r.id}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        const next = v === "" ? null : Math.max(0, Math.round(Number(v)));
                        if (next !== r.aiLimit && (next === null || Number.isFinite(next))) void change(r.id, { aiLimit: next });
                      }}
                    />
                  </label>
                </span>
                <span role="cell" className="admin-actions">
                  {r.status !== "approved" && (
                    <button type="button" className="button" disabled={busy === r.id} onClick={() => change(r.id, { status: "approved" })}>
                      Goedkeuren
                    </button>
                  )}
                  {r.status === "approved" && (
                    <button type="button" className="button secondary" disabled={busy === r.id} onClick={() => change(r.id, { status: "suspended" })}>
                      Pauzeren
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
