"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, MailPlus, UserCheck } from "lucide-react";
import { PageHeading, Badge } from "@/components/ui";

type Space = { workspace_id: string; role: string; workspaces: { name: string } };
const ROLE: Record<string, string> = { OWNER: "Eigenaar", ADMIN: "Beheerder", MEMBER: "Lid" };

export default function TeamPage() {
  const [spaces, setSpaces] = useState<Space[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const invite = useSearchParams().get("invite");
  useEffect(() => {
    fetch("/api/workspaces")
      .then(async (r) => {
        const b = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(b.error || "Werkruimtes konden niet worden geladen.");
        setSpaces(b.workspaces);
      })
      .catch((e) => {
        setMessage(e.message);
        setSpaces([]);
      });
  }, []);
  async function post(url: string, body: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b.error || "Deze actie is niet gelukt.");
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Deze actie is niet gelukt.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading eyebrow="Werkruimte" title="Team" description="Wissel van werkruimte of nodig een collega uit." />
      {invite && (
        <section className="panel account-panel">
          <div className="section-heading">
            <div>
              <h2>
                <UserCheck size={18} aria-hidden="true" /> Uitnodiging accepteren
              </h2>
              <p>Je bent ingelogd met het e-mailadres waarop je de uitnodiging kreeg? Dan kun je nu toetreden.</p>
            </div>
            <button
              type="button"
              disabled={busy}
              className="button primary"
              onClick={async () => {
                if (await post("/api/team", { action: "accept", token: invite })) window.location.replace("/account/team");
              }}
            >
              Accepteren
            </button>
          </div>
        </section>
      )}
      <section className="panel account-panel">
        <div className="section-heading">
          <div>
            <h2>
              <Building2 size={18} aria-hidden="true" /> Mijn werkruimtes
            </h2>
            <p>Elke werkruimte heeft eigen gegevens, koppelingen en teamleden.</p>
          </div>
        </div>
        <div className="account-panel-body">
          {spaces === null ? (
            <p className="field-note" role="status">
              Laden…
            </p>
          ) : !spaces.length ? (
            <p className="field-note">Geen werkruimtes gevonden.</p>
          ) : (
            spaces.map((s) => (
              <div className="st-channel is-static" key={s.workspace_id}>
                <span>
                  <strong>{s.workspaces.name}</strong>
                  <small>{ROLE[s.role] || s.role}</small>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  className="button secondary"
                  onClick={async () => {
                    if (await post("/api/workspaces", { workspaceId: s.workspace_id })) window.location.replace("/dashboard");
                  }}
                >
                  Openen
                </button>
              </div>
            ))
          )}
        </div>
      </section>
      <form
        className="panel account-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await post("/api/team", { email, role })) {
            setMessage("Uitnodiging verstuurd naar " + email + ".");
            setEmail("");
          }
        }}
      >
        <div className="section-heading">
          <div>
            <h2>
              <MailPlus size={18} aria-hidden="true" /> Collega uitnodigen
            </h2>
            <p>Alleen de eigenaar van de actieve werkruimte kan uitnodigen.</p>
          </div>
        </div>
        <div className="account-panel-body">
          <div className="account-fields">
            <label>
              E-mailadres
              <input type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              Rol
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="MEMBER">Lid: werkt mee, kan niet opslaan of koppelen</option>
                <option value="ADMIN">Beheerder: kan alles behalve de werkruimte verwijderen</option>
              </select>
            </label>
          </div>
          <div className="st-row-end">
            <Badge tone="neutral">Besloten beta: uitgenodigde collega&apos;s komen in deze werkruimte</Badge>
            <button disabled={busy || !email} className="button primary">
              Uitnodigen
            </button>
          </div>
        </div>
      </form>
      <p role="status" className="st-feedback">
        {message}
      </p>
    </>
  );
}
