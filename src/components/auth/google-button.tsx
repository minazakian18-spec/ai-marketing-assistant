"use client";
import { authRequest } from "@/lib/auth-client";
import { useState } from "react";
import { Loader2 } from "lucide-react";

// Placeholder OAuth trigger. Google sign-in is not wired to a real provider
// yet — clicking demonstrates the connecting/failure states so the backend
// team has a clear UI contract, without ever claiming a successful login.
export function GoogleButton({ label }: { label: string }) {
  const [status, setStatus] = useState<"idle" | "connecting" | "error">("idle");
  return (
    <div>
      <button
        type="button"
        className="mkt-oauth-btn"
        disabled={status === "connecting"}
        onClick={async () => {
          setStatus("connecting");
          try { await authRequest("google"); } catch { setStatus("error"); }
        }}
      >
        {status === "connecting" ? (
          <Loader2 size={16} className="mkt-spin" />
        ) : (
          <GoogleMark />
        )}
        {status === "connecting" ? "Verbinden met Google…" : label}
      </button>
      {status === "error" && (
        <p className="mkt-auth-banner mkt-auth-banner-error" style={{ marginTop: 12 }}>
          Google-koppeling is nog niet actief. Dit wordt binnenkort aangesloten
          op een echte OAuth-provider.
        </p>
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.16.27-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
    </svg>
  );
}
