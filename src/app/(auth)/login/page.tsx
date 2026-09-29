"use client";
import { Suspense, useState } from "react";
import { startDemo } from "@/lib/demo";
import { authRequest } from "@/lib/auth-client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleButton } from "@/components/auth/google-button";

function LoginForm() {
  const search = useSearchParams();
  const [feedback, setFeedback] = useState("");
  const sessionExpired = search.get("session") === "expired";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  // Real authentication is implemented server-side; this only demonstrates
  // the loading/error UI contract so the backend can be wired in without a
  // redesign. It never grants access.
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const result = await authRequest("login", { email, password });
      setFeedback(result.message || "");
      setStatus("idle");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Probeer opnieuw.");
      setStatus("error");
    }
  }

  return (
    <AuthShell
      title="Welkom terug"
      subtitle="Log in om verder te gaan in je Mavix-werkruimte."
      visualTitle="Eén werkruimte voor je hele marketingteam."
      visualBody="Reviews, Instagram, e-mail en content — allemaal op één plek, aangestuurd door AI die jouw merk kent."
      footer={
        <p className="mkt-auth-footer-link">
          Nog geen account? <Link href="/register">Gratis starten</Link>
        </p>
      }
    >
      {sessionExpired && (
        <div className="mkt-auth-banner mkt-auth-banner-info">
          Je sessie is verlopen. Log opnieuw in om verder te gaan.
        </div>
      )}
      {status === "error" && (
        <div className="mkt-auth-banner mkt-auth-banner-error">
          Inloggen is niet gelukt. Zie de melding hieronder.
        </div>
      )}
      {feedback && <p role="status">{feedback}</p>}
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
        <label>
          Wachtwoord
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <div className="mkt-auth-row">
          <span />
          <Link href="/forgot-password">Wachtwoord vergeten?</Link>
        </div>
        <button
          className="mkt-btn mkt-btn-primary"
          disabled={status === "loading"}
          style={{ width: "100%" }}
        >
          {status === "loading" ? (
            <>
              <Loader2 size={16} className="mkt-spin" /> Bezig met inloggen…
            </>
          ) : (
            "Inloggen"
          )}
        </button>
      </form>
      <div className="mkt-auth-divider">of</div>
      <GoogleButton label="Doorgaan met Google" />
      <div className="mkt-auth-divider">of probeer de demo</div>
      <button
        type="button"
        className="mkt-btn mkt-btn-primary"
        style={{ width: "100%" }}
        onClick={startDemo}
      >
        Testen zonder account
      </button>
      <p>Met voorbeeldgegevens. Wijzigingen blijven in deze browser.</p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
