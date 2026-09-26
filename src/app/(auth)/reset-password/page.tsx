"use client";
import { Suspense, useState } from "react";
import { authRequest } from "@/lib/auth-client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";

function ResetForm() {
  const search = useSearchParams();
  const token = search.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [validationError, setValidationError] = useState("");

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
    try { await authRequest("reset",{password}); } catch(e) {setStatus("error");setValidationError(e instanceof Error ? e.message : "Probeer opnieuw.");}
  }


  return (
    <AuthShell
      title="Nieuw wachtwoord instellen"
      subtitle="Kies een nieuw, sterk wachtwoord voor je account."
      visualTitle="Bijna klaar."
      visualBody="Na het instellen van je nieuwe wachtwoord kun je direct weer inloggen."
    >
      {status === "done" ? (
        <>
          <div className="mkt-auth-banner mkt-auth-banner-success">
            <CheckCircle2 size={17} style={{ flexShrink: 0 }} />
            <span>
              Je wachtwoord is bijgewerkt.
              <br />
            </span>
          </div>
          <Link href="/login" className="mkt-btn mkt-btn-primary" style={{ width: "100%" }}>
            Naar inloggen
          </Link>
        </>
      ) : (
        <>
          {validationError && (
            <div className="mkt-auth-banner mkt-auth-banner-error">
              {validationError}
            </div>
          )}
          <form className="mkt-auth-form" onSubmit={submit}>
            <label>
              Nieuw wachtwoord
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              Bevestig nieuw wachtwoord
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
                  <Loader2 size={16} className="mkt-spin" /> Bezig…
                </>
              ) : (
                "Wachtwoord instellen"
              )}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
