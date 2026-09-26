"use client";
import { Suspense, useState } from "react";
import { authRequest } from "@/lib/auth-client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleButton } from "@/components/auth/google-button";
import { pricingPlans } from "@/lib/pricing-data";

function RegisterForm() {
  const search = useSearchParams();
  const [feedback,setFeedback]=useState("");
  const plan = pricingPlans.find((p) => p.id === search.get("plan"));
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [validationError, setValidationError] = useState("");

  // Client-side validation only; account creation itself is implemented by
  // the backend. This never creates a real account.
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError("");
    if (password.length < 12) {
      setValidationError("Gebruik een wachtwoord van minstens 12 tekens.");
      return;
    }
    if (password !== confirm) {
      setValidationError("De wachtwoorden komen niet overeen.");
      return;
    }
    setStatus("loading");
    try { const result = await authRequest('register', {email,password,name,businessName}); setFeedback(result.message || ''); setStatus('idle'); } catch (error) { setFeedback(error instanceof Error ? error.message : 'Probeer opnieuw.'); setStatus('error'); }
  }

  return (
    <AuthShell
      title="Maak je Mavix-account"
      subtitle="Start gratis, geen creditcard nodig."
      visualTitle="Van eerste idee naar gepubliceerde content, in minuten."
      visualBody="Vertel Mavix over je bedrijf en het regelt de rest — jij houdt overal de controle."
      footer={
        <p className="mkt-auth-footer-link">
          Al een account? <Link href="/login">Inloggen</Link>
        </p>
      }
    >
      {plan && (
        <div className="mkt-auth-banner mkt-auth-banner-info">
          Je start met het <strong>{plan.name}</strong>-abonnement. Je kunt dit
          later altijd wijzigen.
        </div>
      )}
      {(validationError || status === "error") && (
        <div className="mkt-auth-banner mkt-auth-banner-error">
          {validationError ||
            "Registreren is niet gelukt. Zie de melding hieronder."}
        </div>
      )}
      {feedback && <p role="status">{feedback}</p>}
      <form className="mkt-auth-form" onSubmit={submit}>
        <label>
          Naam
          <input
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Bedrijfsnaam
          <input
            required
            autoComplete="organization"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
        </label>
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label>
          Bevestig wachtwoord
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <button
          className="mkt-btn mkt-btn-primary"
          disabled={status === "loading"}
          style={{ width: "100%" }}
        >
          {status === "loading" ? (
            <>
              <Loader2 size={16} className="mkt-spin" /> Account aanmaken…
            </>
          ) : (
            "Gratis starten"
          )}
        </button>
      </form>
      <div className="mkt-auth-divider">of</div>
      <GoogleButton label="Doorgaan met Google" />
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
