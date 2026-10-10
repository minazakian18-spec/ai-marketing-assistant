"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Save, ShieldCheck, Sparkles } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PageHeading } from "@/components/ui";
import {
  LANGUAGES,
  TONE_PRESETS,
  strategyOf,
  voiceOf,
  type TonePreset,
} from "@/lib/brand-strategy";
import { defaultInstagram } from "@/lib/instagram-model";
import { defaultEmail } from "@/lib/email-model";

export function AiPreferences() {
  const { data, save } = useWorkspace();
  const strategy = strategyOf(data.profile);
  const [language, setLanguage] = useState(strategy.language);
  const [tone, setTone] = useState<TonePreset | "">(strategy.tonePreset || "");
  const [preferences, setPreferences] = useState(
    data.profile.contentPreferences || "",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dirty =
    language !== strategy.language ||
    tone !== (strategy.tonePreset || "") ||
    preferences !== (data.profile.contentPreferences || "");
  const channels = [
    {
      name: "Instagram",
      href: "/social",
      settings: data.instagram || defaultInstagram,
    },
    {
      name: "E-mail",
      href: "/email",
      settings: data.email?.settings || defaultEmail,
    },
    { name: "Reviews", href: "/reviews", settings: data.review.settings },
  ];

  return (
    <>
      <PageHeading
        eyebrow="Werkruimte"
        title="AI-voorkeuren"
        description="Geef Mavi een vaste basis. Per bericht of kanaal kun je hiervan afwijken."
      />
      <form
        onChange={() => setMessage("")}
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          const preset = TONE_PRESETS.find((p) => p.id === tone);
          const changedTone = tone !== (strategy.tonePreset || "");
          const profile = {
            ...data.profile,
            contentPreferences: preferences.trim(),
            strategy: { ...strategy, language, tonePreset: tone || undefined },
            ...(changedTone && preset
              ? {
                  voice: preset.voice,
                  brandVoice: {
                    ...voiceOf(data.profile),
                    formality: preset.formality,
                    emojiUsage: preset.emoji,
                  },
                }
              : {}),
          };
          try {
            const ok = await save(
              { ...data, profile },
              "AI-voorkeuren opgeslagen",
            );
            setMessage(
              ok
                ? "Opgeslagen. Mavi gebruikt deze voorkeuren voor nieuwe content."
                : "Opslaan is niet gelukt. Je wijzigingen staan nog in het formulier.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <section className="panel account-panel">
          <div className="section-heading">
            <div>
              <h2>
                <Sparkles size={18} aria-hidden="true" /> De stem van je merk
              </h2>
              <p>Deze voorkeuren worden ook in Brand Hub bijgewerkt.</p>
            </div>
          </div>
          <fieldset
            className="account-panel-body st-preferences"
            disabled={busy}
          >
            <div className="account-fields">
              <label>
                Standaardtaal
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Voorkeurstoon
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as TonePreset | "")}
                >
                  <option value="">Eigen merkstem behouden</option>
                  {TONE_PRESETS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="field-note">
              Antwoorden volgen de taal van de klant. Een eigen reviewtoon of
              instructie bij een bericht gaat voor.
            </p>
            <label>
              Contentvoorkeuren
              <textarea
                rows={4}
                maxLength={2000}
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                placeholder="Bijvoorbeeld: praktische tips en verhalen achter de schermen; geen politieke onderwerpen."
              />
            </label>
            <Link href="/brand-hub" className="text-link">
              Doelgroep, woorden en merkpersoonlijkheid aanpassen{" "}
              <ArrowUpRight size={14} />
            </Link>
          </fieldset>
        </section>
        <div className="account-save">
          <p role="status">
            {message || (dirty ? "Je hebt niet-opgeslagen wijzigingen." : "")}
          </p>
          <button className="button primary" disabled={busy || !dirty}>
            <Save size={16} />
            {busy ? "Opslaan…" : "Voorkeuren opslaan"}
          </button>
        </div>
      </form>
      <section className="panel account-panel st-automation">
        <div className="section-heading">
          <div>
            <h2>
              <ShieldCheck size={18} aria-hidden="true" /> Goedkeuring en
              automatisering
            </h2>
            <p>
              Elk kanaal heeft zijn eigen planning en publicatieregels. Pas ze
              aan in de bijbehorende module.
            </p>
          </div>
        </div>
        {channels.map(({ name, href, settings }) => (
          <Link key={name} href={href} className="st-channel">
            <span>
              <strong>{name}</strong>
              <small>
                {settings.mode === "auto" && settings.enabled
                  ? "Automatisch aanmaken ingeschakeld"
                  : "Content maken op verzoek"}
              </small>
            </span>
            <span className="st-status">
              <Check size={13} />
              {settings.requireApproval
                ? "Eerst goedkeuren"
                : "Zonder goedkeuring"}
            </span>
            <ArrowUpRight size={16} />
          </Link>
        ))}
      </section>
    </>
  );
}
