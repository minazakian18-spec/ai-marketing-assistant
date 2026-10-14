"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { pricingPlans, type PricingPlan } from "@/lib/pricing-data";

// Demo request or account application. Sends to /api/applications; the
// server validates, rate limits and stores it for review. Nothing here
// creates an account, starts a payment or grants access.

type Kind = "demo" | "application";

export function ApplicationForm({ kind, initialPlan }: { kind: Kind; initialPlan?: PricingPlan["id"] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", company: "", phone: "", website: "", industry: "", message: "", preferredTime: "", fax: "" });
  const [plan, setPlan] = useState<PricingPlan["id"] | "">(initialPlan || "");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState("");
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (kind === "application" && !plan) return setError("Kies het pakket waarin je interesse hebt.");
    if (!consent) return setError("Geef toestemming om je gegevens te gebruiken voor deze aanvraag.");
    setStatus("loading");
    try {
      const r = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ...form, plan: plan || undefined, consent: true }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || "Versturen is niet gelukt. Probeer het opnieuw.");
      router.push("/aanvragen/bedankt?type=" + kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Versturen is niet gelukt. Probeer het opnieuw.");
      setStatus("idle");
    }
  }

  return (
    <form className="mkt-auth-form" onSubmit={submit} noValidate>
      {error && (
        <div className="mkt-auth-banner mkt-auth-banner-error" role="alert">
          {error}
        </div>
      )}
      {kind === "application" && (
        <fieldset className="mkt-plan-pick">
          <legend>Pakket</legend>
          {pricingPlans.map((p) => (
            <label key={p.id} className={"mkt-plan-option" + (plan === p.id ? " is-selected" : "")}>
              <input type="radio" name="plan" value={p.id} checked={plan === p.id} onChange={() => setPlan(p.id)} />
              <span>
                <strong>{p.name}</strong>
                <small>{p.tagline}</small>
              </span>
              <em>€{p.monthlyPrice} p/m</em>
            </label>
          ))}
          <p className="mkt-plan-note">Prijzen exclusief btw. Je betaalt pas nadat je aanvraag is goedgekeurd.</p>
        </fieldset>
      )}
      <label>
        Naam
        <input required autoComplete="name" maxLength={100} value={form.name} onChange={set("name")} />
      </label>
      <label>
        Bedrijfsnaam
        <input required autoComplete="organization" maxLength={160} value={form.company} onChange={set("company")} />
      </label>
      <label>
        Zakelijk e-mailadres
        <input type="email" required autoComplete="email" maxLength={254} value={form.email} onChange={set("email")} />
      </label>
      <label>
        Telefoonnummer (optioneel)
        <input type="tel" autoComplete="tel" maxLength={40} value={form.phone} onChange={set("phone")} />
      </label>
      {kind === "application" && (
        <label>
          Website (optioneel)
          <input type="url" autoComplete="url" maxLength={300} placeholder="https://" value={form.website} onChange={set("website")} />
        </label>
      )}
      <label>
        Branche (optioneel)
        <input maxLength={100} placeholder="Bijv. restaurant, kapsalon, webshop" value={form.industry} onChange={set("industry")} />
      </label>
      {kind === "demo" && (
        <label>
          Wanneer schikt het meestal? (optioneel)
          <input maxLength={200} placeholder="Bijv. dinsdag- of donderdagochtend" value={form.preferredTime} onChange={set("preferredTime")} />
        </label>
      )}
      <label>
        {kind === "demo" ? "Waar wil je meer over weten? (optioneel)" : "Toelichting (optioneel)"}
        <textarea rows={3} maxLength={2000} value={form.message} onChange={set("message")} />
      </label>
      {/* Honeypot for bots; hidden from people and screen readers. */}
      <input type="text" name="fax" tabIndex={-1} autoComplete="off" value={form.fax} onChange={set("fax")} className="mkt-hp" aria-hidden="true" />
      <label className="mkt-consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          Mavix mag mijn gegevens gebruiken om contact met mij op te nemen over deze aanvraag. Zie de <Link href="/legal/privacy">privacyverklaring</Link>.
        </span>
      </label>
      <button className="mkt-btn mkt-btn-primary" disabled={status === "loading"} style={{ width: "100%" }}>
        {status === "loading" ? (
          <>
            <Loader2 size={16} className="mkt-spin" /> Versturen…
          </>
        ) : kind === "demo" ? (
          "Demo aanvragen"
        ) : (
          "Aanvraag versturen"
        )}
      </button>
    </form>
  );
}
