"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronDown, FileText, Film, Instagram, Mail, PenLine, Wand2 } from "lucide-react";
import { CHANNELS, COPY_KINDS, type CopyKind, type StudioChannel } from "@/lib/studio";
import "../../../studio.css";

// "Nieuwe content maken": two short steps, then the real editor of that
// channel (Instagram, e-mail or marketing copy) takes over. The brief is
// handed over in the URL; the editor stores the content in the same records
// as the rest of Mavix.

const ICON: Record<StudioChannel, typeof Instagram> = { instagram: Instagram, email: Mail, copy: FileText, reel: Film };
const PLACEHOLDER: Record<StudioChannel, string> = {
  instagram: "Bijvoorbeeld: onze nieuwe pizza van de maand, voor gezinnen in het weekend",
  email: "Bijvoorbeeld: nieuwsbrief over de zomerkaart en onze terrasavonden",
  copy: "Bijvoorbeeld: een korte over-ons-tekst voor de website",
  reel: "",
};

function NewContent() {
  const router = useRouter();
  const search = useSearchParams();
  const preset = CHANNELS.find((c) => c.id === search.get("kanaal") && c.available)?.id ?? null;
  const [channel, setChannel] = useState<StudioChannel | null>(preset);
  const [brief, setBrief] = useState("");
  const [more, setMore] = useState(false);
  const [goal, setGoal] = useState("");
  const [cta, setCta] = useState("");
  const [language, setLanguage] = useState("nl");
  const [kind, setKind] = useState<CopyKind>("website");

  function go(start: "ai" | "manual") {
    if (!channel) return;
    const extra = [goal && "Doel: " + goal, cta && "Call-to-action: " + cta, language === "en" && "Schrijf in het Engels."].filter(Boolean).join(". ");
    const text = [brief.trim(), extra].filter(Boolean).join(". ").slice(0, 1500);
    const q = new URLSearchParams({ brief: text, start });
    if (channel === "instagram") router.push("/social?tab=assist&" + q);
    else if (channel === "email") router.push("/email?tab=assist&" + q);
    else router.push("/studio/tekst?" + q + "&kind=" + kind);
  }

  return (
    <div className="st2 st2-new">
      <Link href="/studio" className="st2-back">
        <ArrowLeft size={15} aria-hidden="true" /> Content Studio
      </Link>
      <header className="st2-head">
        <div>
          <h1>Nieuwe content maken</h1>
          <p>Kies een kanaal en beschrijf je idee. Mavix maakt er een concept van dat je daarna aanpast.</p>
        </div>
      </header>

      <section className="st2-step" aria-labelledby="step-1">
        <h2 id="step-1">
          <span className="st2-step-n">1</span> Waarvoor maak je content?
        </h2>
        <div className="st2-choice" role="radiogroup" aria-label="Kanaal">
          {CHANNELS.map((c) => {
            const Icon = ICON[c.id];
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={channel === c.id}
                disabled={!c.available}
                className={"st2-choice-item" + (channel === c.id ? " is-on" : "")}
                onClick={() => setChannel(c.id)}
              >
                <span className={"st2-channel-icon is-" + c.id}>
                  <Icon size={18} aria-hidden="true" />
                </span>
                <strong>
                  {c.label}
                  {!c.available && <small> Binnenkort</small>}
                </strong>
                <span>{c.available ? c.description : c.note}</span>
              </button>
            );
          })}
        </div>
      </section>

      {channel && (
        <section className="st2-step" aria-labelledby="step-2">
          <h2 id="step-2">
            <span className="st2-step-n">2</span> Wat wil je vertellen?
          </h2>
          <form
            className="st2-brief"
            onSubmit={(e) => {
              e.preventDefault();
              if (brief.trim()) go("ai");
            }}
          >
            <label className="sr-only" htmlFor="st2-brief">
              Beschrijf je idee
            </label>
            <textarea
              id="st2-brief"
              rows={3}
              maxLength={1200}
              autoFocus
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder={PLACEHOLDER[channel]}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && brief.trim()) {
                  e.preventDefault();
                  go("ai");
                }
              }}
            />
            {channel === "copy" && (
              <label className="st2-field">
                <span>Soort tekst</span>
                <select value={kind} onChange={(e) => setKind(e.target.value as CopyKind)}>
                  {COPY_KINDS.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label} — {k.hint}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button type="button" className="st2-more" aria-expanded={more} onClick={() => setMore(!more)}>
              <ChevronDown size={14} aria-hidden="true" /> Meer opties (optioneel)
            </button>
            {more && (
              <div className="st2-more-fields">
                <label className="st2-field">
                  <span>Doel</span>
                  <input value={goal} maxLength={120} onChange={(e) => setGoal(e.target.value)} placeholder="Bijv. meer reserveringen op doordeweekse avonden" />
                </label>
                <label className="st2-field">
                  <span>Call-to-action</span>
                  <input value={cta} maxLength={120} onChange={(e) => setCta(e.target.value)} placeholder="Bijv. Reserveer via de link in bio" />
                </label>
                <label className="st2-field">
                  <span>Taal</span>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option value="nl">Nederlands</option>
                    <option value="en">Engels</option>
                  </select>
                </label>
                <p className="st2-muted">Doelgroep en tone of voice komen uit je Brand Hub. Je kunt ze in de editor nog aanpassen.</p>
              </div>
            )}
            <div className="st2-brief-actions">
              <button type="button" className="button secondary" onClick={() => go("manual")}>
                <PenLine size={15} /> Zelf schrijven
              </button>
              <button type="submit" className="button primary" disabled={!brief.trim()}>
                <Wand2 size={15} /> Maak met Mavix AI
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p role="status">Laden…</p>}>
      <NewContent />
    </Suspense>
  );
}
