"use client";
import { useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";

// Premium: one personal 20-minute marketing call per billing period with
// someone from Mavix (not the AI). Booking opens the owner's agenda tool.
type Status = { entitled: boolean; used: boolean; bookingOpen: boolean; periodEnd: string };

export function AdviceCall() {
  const [s, setS] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/advice", { cache: "no-store" })
      .then(async (r) => (r.ok ? setS(await r.json()) : null))
      .catch(() => {});
  }, []);
  if (!s?.entitled) return null;
  async function book() {
    setBusy(true);
    setError("");
    const r = await fetch("/api/advice", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok || !d.url) return setError(d.error || "Inplannen is nu niet mogelijk.");
    window.open(d.url, "_blank", "noopener");
    setS({ ...s!, used: true });
  }
  const until = new Date(s.periodEnd).toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
  return (
    <div className="st-channel is-static">
      <span>
        <strong>
          <CalendarCheck size={14} aria-hidden="true" /> Persoonlijk marketingadvies
        </strong>
        <small>
          Elke maand 20 minuten met een adviseur van Mavix (geen AI): contentstrategie, Instagram, meer klanten, SEO, reviews, je resultaten en het gebruik van Mavix. Niet gebruikte gesprekken schuiven niet door.
        </small>
        {s.used ? (
          <small>Je gesprek voor deze periode is ingepland. Een nieuw gesprek kan vanaf {until}.</small>
        ) : s.bookingOpen ? (
          <button type="button" className="button secondary" disabled={busy} onClick={() => void book()}>
            Gesprek inplannen
          </button>
        ) : (
          <small>Online inplannen is nog niet geopend. Mavix neemt contact met je op om een moment te kiezen.</small>
        )}
        {error && <small className="field-error">{error}</small>}
      </span>
    </div>
  );
}
