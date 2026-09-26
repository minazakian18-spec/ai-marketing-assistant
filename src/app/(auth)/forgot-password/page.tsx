"use client";
import { useState } from "react";
import { authRequest } from "@/lib/auth-client";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  const [error,setError]=useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    // Design preview only: no e-mail is actually sent until the backend
    // wires up a real reset flow. The copy below is intentionally the
    // correct production copy (never reveals whether an account exists).
    try { await authRequest("forgot",{email}); setStatus("sent"); } catch(e) { setStatus("idle"); setError(e instanceof Error ? e.message : "Probeer opnieuw."); }
  }

  return (
    <AuthShell
      title="Wachtwoord vergeten"
      subtitle="Vul je e-mailadres in en we sturen je een link om je wachtwoord te resetten."
      visualTitle="Kom zo terug in je werkruimte."
      visualBody="Je content, planning en instellingen staan te wachten."
      footer={
        <p className="mkt-auth-footer-link">
          <Link href="/login">Terug naar inloggen</Link>
        </p>
      }
    >
      {error && <p role="alert">{error}</p>}
      {status === "sent" ? (
        <div className="mkt-auth-banner mkt-auth-banner-success">
          <MailCheck size={17} style={{ flexShrink: 0 }} />
          <span>
            Als dit e-mailadres bij ons bekend is, ontvang je een link om je
            wachtwoord te resetten.
            <br />
          </span>
        </div>
      ) : (
        <form className="mkt-auth-form" onSubmit={submit}>
          <label>
            E-mailadres
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button
            className="mkt-btn mkt-btn-primary"
            disabled={status === "loading"}
            style={{ width: "100%" }}
          >
            {status === "loading" ? (
              <>
                <Loader2 size={16} className="mkt-spin" /> Bezig…
              </>
            ) : (
              "Stuur resetlink"
            )}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
