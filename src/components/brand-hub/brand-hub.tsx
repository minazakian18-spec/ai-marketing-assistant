"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ImageIcon,
  LayoutGrid,
  Megaphone,
  Palette,
  Pencil,
  Target,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PageHeading } from "@/components/ui";
import { SegmentsManager } from "@/components/brand/segments-manager";
import { ProductsManager } from "@/components/brand/products-manager";
import { WebsiteImport } from "@/components/brand/website-import";
import type { Profile } from "@/lib/types";
import {
  brandVoiceValid,
  productValid,
  segmentValid,
  type BrandVoice,
} from "@/lib/brand-model";
import {
  CHANNELS,
  HEX,
  STEPS,
  TONE_PRESETS,
  TYPOGRAPHY,
  completion,
  languageLabel,
  objectiveLabel,
  stepErrors,
  strategyOf,
  strategyValid,
  voiceOf,
  type BrandStrategy,
} from "@/lib/brand-strategy";
import { BrandPreview, type PreviewText } from "./brand-preview";
import { StepGoals, StepIdentity, StepVisual, StepVoice } from "./brand-steps";

// Brand Hub: a guided four-step setup (identity, audience & voice, visuals,
// goals) with a summary, and an overview once the brand is set up. Existing
// profiles are reused as they are; nobody has to start over.
// Drafts are kept in this browser while typing and saved to the workspace on
// every "Opslaan en verder".

const DRAFT_KEY = "mavix.brandhub.draft.v1";
const ICONS = [Building2, Megaphone, Palette, Target];
const WHY: Record<number, { title: string; text: string; points: string[] }> = {
  1: {
    title: "Zo leert Mavi je bedrijf kennen",
    text: "Met je naam, branche en omschrijving begrijpt Mavi wat je doet. Je unieke kenmerken maken content onderscheidend in plaats van algemeen.",
    points: [
      "Wordt gebruikt in posts, e-mails, antwoorden op berichten en reviews",
      "Mavi noemt alleen wat jij hier invult; er worden geen feiten verzonnen",
    ],
  },
  2: {
    title: "Je merkstem in elke tekst",
    text: "Toon, aanspreekvorm en persoonlijkheid bepalen hoe Mavi schrijft. Woorden die je wilt vermijden, gebruikt Mavi nooit.",
    points: [
      "Geldt voor Instagram, e-mail, Inbox-antwoorden en reviewreacties",
      "Een kanaal met eigen instellingen (zoals reviewtoon) gaat voor",
    ],
  },
  3: {
    title: "Herkenbaar in beeld",
    text: "Logo, kleuren en stijl zorgen dat visuele content bij je huisstijl past. Bedrijfsfoto's zijn nodig voor automatische Instagram-posts.",
    points: [
      "Afbeeldingen worden verkleind en zonder metadata (zoals locatie) opgeslagen",
      "Alleen PNG, JPG en WebP",
    ],
  },
  4: {
    title: "Content met een doel",
    text: "Je hoofddoel en kanalen bepalen waar Mavi de nadruk op legt. De call-to-action wordt standaard gebruikt als je per post niets anders kiest.",
    points: [
      "Lopende aanbiedingen worden alleen genoemd zoals jij ze invult",
      "Je kunt je doelen altijd aanpassen",
    ],
  },
};

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

function validDraft(p: Profile) {
  return (
    [
      "name",
      "industry",
      "audience",
      "description",
      "voice",
      "website",
      "phone",
      "address",
      "postalCode",
      "city",
      "country",
      "vatNumber",
    ].every((k) => typeof (p as Record<string, unknown>)[k] === "string") &&
    (!p.strategy || strategyValid(p.strategy)) &&
    (!p.brandVoice || brandVoiceValid(p.brandVoice)) &&
    (!p.productList ||
      (Array.isArray(p.productList) && p.productList.every(productValid))) &&
    (!p.segments ||
      (Array.isArray(p.segments) && p.segments.every(segmentValid))) &&
    (!p.media ||
      (Array.isArray(p.media) &&
        p.media.every((s) => typeof s === "string"))) &&
    [p.products, p.offers, p.logo, p.contentPreferences].every(
      (s) => s === undefined || typeof s === "string",
    )
  );
}

function firstOpenStep(p: Profile) {
  const c = completion(p);
  for (const st of STEPS)
    if (Object.keys(stepErrors(st.id, p)).length) return st.id;
  return c.perStep.find((x) => x.filled < x.total)?.step || 5;
}

export function BrandHub() {
  const { data, ready, save, draftScope } = useWorkspace();
  const draftKey = `${DRAFT_KEY}:${draftScope}`;
  const [draftStatus, setDraftStatus] = useState("");
  const [draft, setDraft] = useState<Profile>(data.profile);
  const [mode, setMode] = useState<"wizard" | "overview">("overview");
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [restored, setRestored] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<PreviewText>(null);
  const [previewProfile, setPreviewProfile] = useState<Profile | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const initialised = useRef(false);
  const panel = useRef<HTMLDivElement>(null);

  // First load: reuse the saved profile; restore an unsaved draft from this browser.
  useEffect(() => {
    if (!ready || initialised.current) return;
    initialised.current = true;
    let start = data.profile;
    let restoredStep: number | undefined;
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        const saved = JSON.parse(raw) as {
          profile?: Profile;
          base?: Profile;
          step?: number;
        };
        if (
          saved.profile &&
          validDraft(saved.profile) &&
          same(saved.base, data.profile) &&
          !same(saved.profile, data.profile)
        ) {
          start = { ...data.profile, ...saved.profile };
          setRestored(true);
        } else sessionStorage.removeItem(draftKey);
        if (
          saved.step &&
          Number.isInteger(saved.step) &&
          saved.step >= 1 &&
          saved.step <= 5
        )
          restoredStep = saved.step;
      }
    } catch {
      /* no draft */
    }
    setDraft(start);
    const s = strategyOf(start);
    const pct = completion(start).percent;
    if (
      s.finishedAt ||
      pct >= 80 ||
      (!start.strategy && start.name && start.description)
    )
      setMode("overview");
    else {
      setMode("wizard");
      setStep(restoredStep || Math.min(firstOpenStep(start), 4));
    }
  }, [ready, data.profile, draftKey]);

  // Saved elsewhere (segments, products, website import, another save): take
  // over every field this draft has not changed itself.
  const base = useRef<Profile>(data.profile);
  useEffect(() => {
    if (!initialised.current) {
      base.current = data.profile;
      return;
    }
    const prev = base.current;
    base.current = data.profile;
    if (same(prev, data.profile)) return;
    setDraft((d) => {
      const next = { ...d } as Record<string, unknown>;
      const saved = data.profile as Record<string, unknown>;
      for (const k of new Set([...Object.keys(saved), ...Object.keys(prev)]))
        if (
          same(
            (d as Record<string, unknown>)[k],
            (prev as Record<string, unknown>)[k],
          )
        )
          next[k] = saved[k];
      return next as Profile;
    });
  }, [data.profile]);

  // Automatic draft saving in this browser while typing.
  useEffect(() => {
    if (!initialised.current) return;
    setDraftStatus("Concept bewaren…");
    const t = window.setTimeout(() => {
      try {
        sessionStorage.setItem(
          draftKey,
          JSON.stringify({
            profile: draft,
            base: data.profile,
            step,
            savedAt: new Date().toISOString(),
          }),
        );
        setDraftStatus("Concept bewaard in dit tabblad");
      } catch {
        setDraftStatus("Concept niet bewaard. Gebruik Opslaan en verder.");
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [draft, data.profile, draftKey, step]);

  const setProfile = useCallback(
    (patch: Partial<Profile>) => setDraft((p) => ({ ...p, ...patch })),
    [],
  );
  const setStrategy = useCallback(
    (patch: Partial<BrandStrategy>) =>
      setDraft((p) => ({ ...p, strategy: { ...strategyOf(p), ...patch } })),
    [],
  );
  const setVoice = useCallback(
    (patch: Partial<BrandVoice>) =>
      setDraft((p) => ({ ...p, brandVoice: { ...voiceOf(p), ...patch } })),
    [],
  );

  const progress = useMemo(() => completion(draft), [draft]);
  const strategy = strategyOf(draft);
  const dirty = !same(draft, data.profile);

  async function persist(profile: Profile, message: string) {
    setBusy(true);
    const ok = await save({ ...data, profile }, message);
    setBusy(false);
    if (ok) {
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      setRestored(false);
    }
    return ok;
  }

  function go(next: number) {
    setErrors({});
    setStep(next);
    window.setTimeout(
      () =>
        panel.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
          block: "start",
        }),
      0,
    );
  }

  async function saveAndNext() {
    const e = stepErrors(step, draft);
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() =>
        panel.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus(),
      );
      return;
    }
    const completedSteps = [
      ...new Set([...strategy.completedSteps, step]),
    ].sort();
    const profile = { ...draft, strategy: { ...strategy, completedSteps } };
    setDraft(profile);
    if (
      await persist(profile, step < 4 ? "Stap opgeslagen" : "Doelen opgeslagen")
    )
      go(step + 1);
  }

  async function finish() {
    const missing = STEPS.find(
      (st) => Object.keys(stepErrors(st.id, draft)).length,
    );
    if (missing) {
      go(missing.id);
      setErrors(stepErrors(missing.id, draft));
      return;
    }
    const profile = {
      ...draft,
      strategy: {
        ...strategy,
        completedSteps: [1, 2, 3, 4],
        finishedAt: strategy.finishedAt || new Date().toISOString(),
      },
    };
    setDraft(profile);
    if (await persist(profile, "Je merkprofiel is klaar")) setMode("overview");
  }

  async function preview() {
    setPreviewBusy(true);
    setPreviewError("");
    try {
      const r = await fetch("/api/brand/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          industry: draft.industry,
          description: draft.description,
          audience: draft.audience,
          voice: draft.voice,
          website: draft.website,
          city: draft.city,
          country: draft.country,
          brandVoice: voiceOf(draft),
          strategy: {
            usps: strategy.usps,
            audienceInterests: strategy.audienceInterests,
            language: strategy.language,
            tonePreset: strategy.tonePreset,
            personality: strategy.personality,
            ctas: strategy.ctas,
            objective: strategy.objective,
          },
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok)
        throw new Error(d.error || "Mavi kon geen voorbeeld schrijven.");
      setAi(d);
      setPreviewProfile(draft);
    } catch (e) {
      setPreviewError(
        e instanceof Error ? e.message : "Mavi kon geen voorbeeld schrijven.",
      );
    } finally {
      setPreviewBusy(false);
    }
  }

  const stepProps = {
    profile: draft,
    errors,
    setProfile,
    setStrategy,
    setVoice,
  };

  return (
    <div className="bh">
      <PageHeading
        eyebrow="Merk"
        title="Brand Hub"
        description="Het geheugen van je merk. Mavi gebruikt dit in al je posts, e-mails en antwoorden."
      />

      {restored && (
        <p className="bh-notice" role="status">
          We hebben je niet-opgeslagen wijzigingen teruggezet.
          <button
            type="button"
            onClick={() => {
              setDraft(data.profile);
              setRestored(false);
              try {
                sessionStorage.removeItem(draftKey);
              } catch {
                /* ignore */
              }
            }}
          >
            Wijzigingen verwerpen
          </button>
        </p>
      )}

      <div className="bh-topbar">
        <div
          className="bh-meter"
          aria-label={`Merkprofiel ${progress.percent}% compleet`}
        >
          <div className="bh-meter-bar">
            <span style={{ width: progress.percent + "%" }} />
          </div>
          <span>
            <strong>{progress.percent}%</strong> compleet
          </span>
        </div>
        <div className="bh-seg" role="group" aria-label="Weergave">
          <button
            type="button"
            aria-pressed={mode === "overview"}
            onClick={() => setMode("overview")}
          >
            <LayoutGrid size={14} aria-hidden="true" /> Overzicht
          </button>
          <button
            type="button"
            aria-pressed={mode === "wizard"}
            onClick={() => {
              setMode("wizard");
              setStep(Math.min(firstOpenStep(draft), 4));
            }}
          >
            <Pencil size={14} aria-hidden="true" /> Stap voor stap
          </button>
        </div>
      </div>

      {mode === "wizard" ? (
        <>
          <nav className="bh-stepper" aria-label="Stappen">
            <div className="bh-stepper-track" aria-hidden="true">
              <span
                style={{ width: `${((Math.min(step, 5) - 1) / 4) * 100}%` }}
              />
            </div>
            {[
              ...STEPS.map((s) => ({
                id: s.id as number,
                short: s.short as string,
              })),
              { id: 5, short: "Samenvatting" },
            ].map((s) => {
              const Icon = s.id <= 4 ? ICONS[s.id - 1] : Check;
              const done =
                s.id <= 4 &&
                strategy.completedSteps.includes(s.id) &&
                !Object.keys(stepErrors(s.id, draft)).length;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={
                    "bh-step" +
                    (step === s.id ? " is-current" : "") +
                    (done ? " is-done" : "")
                  }
                  aria-current={step === s.id ? "step" : undefined}
                  onClick={() => go(s.id)}
                >
                  <span className="bh-step-dot">
                    {done && step !== s.id ? (
                      <Check size={14} aria-hidden="true" />
                    ) : (
                      <Icon size={15} aria-hidden="true" />
                    )}
                  </span>
                  <span className="bh-step-label">
                    <small>{s.id <= 4 ? `Stap ${s.id}` : "Klaar"}</small>
                    {s.short}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="bh-layout" ref={panel}>
            <section
              className="ui-card bh-panel"
              key={step}
              aria-labelledby="bh-step-title"
            >
              {step <= 4 ? (
                <>
                  <header className="bh-panel-head">
                    <span className="bh-panel-icon" aria-hidden="true">
                      {(() => {
                        const I = ICONS[step - 1];
                        return <I size={18} />;
                      })()}
                    </span>
                    <div>
                      <small>
                        Stap {step} van 4 · {progress.perStep[step - 1].filled}{" "}
                        van {progress.perStep[step - 1].total} ingevuld
                      </small>
                      <h2 id="bh-step-title">{STEPS[step - 1].title}</h2>
                    </div>
                  </header>
                  {step === 1 && <StepIdentity {...stepProps} />}
                  {step === 2 && (
                    <StepVoice
                      {...stepProps}
                      ai={same(previewProfile, draft) ? ai : null}
                      onPreview={() => void preview()}
                      previewBusy={previewBusy}
                      previewError={previewError}
                    />
                  )}
                  {step === 3 && <StepVisual {...stepProps} />}
                  {step === 4 && <StepGoals {...stepProps} />}
                  <footer className="bh-actions">
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => go(step - 1)}
                      disabled={step === 1 || busy}
                    >
                      <ArrowLeft size={15} aria-hidden="true" /> Vorige
                    </button>
                    <span className="bh-autosave" role="status">
                      {dirty ? draftStatus : "Alles opgeslagen"}
                    </span>
                    <button
                      type="button"
                      className="button primary"
                      onClick={() => void saveAndNext()}
                      disabled={busy || !ready}
                    >
                      {busy
                        ? "Opslaan…"
                        : step < 4
                          ? "Opslaan en verder"
                          : "Naar samenvatting"}{" "}
                      <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  </footer>
                </>
              ) : (
                <Summary
                  profile={draft}
                  onEdit={go}
                  onFinish={() => void finish()}
                  busy={busy}
                />
              )}
            </section>
            <aside className="bh-aside">
              {step <= 4 ? (
                <>
                  <div className="bh-why">
                    <h3>{WHY[step].title}</h3>
                    <p>{WHY[step].text}</p>
                    <ul>
                      {WHY[step].points.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>
                  {(step === 3 || step === 4) && (
                    <BrandPreview
                      profile={draft}
                      ai={same(previewProfile, draft) ? ai : null}
                    />
                  )}
                  {step === 1 && progress.perStep[0].missing.length > 0 && (
                    <div className="bh-why">
                      <h3>Nog in te vullen</h3>
                      <ul>
                        {progress.perStep[0].missing.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <BrandPreview
                  profile={draft}
                  ai={same(previewProfile, draft) ? ai : null}
                />
              )}
            </aside>
          </div>
        </>
      ) : (
        <Overview profile={draft} onEdit={(s) => (setMode("wizard"), go(s))} />
      )}
    </div>
  );
}

function rows(p: Profile): Record<number, [string, string][]> {
  const s = strategyOf(p);
  const v = voiceOf(p);
  const tone = TONE_PRESETS.find((t) => t.id === s.tonePreset);
  const font = (id: string) => TYPOGRAPHY.find((t) => t.id === id)?.label || "";
  return {
    1: [
      ["Bedrijfsnaam", p.name],
      ["Branche", p.industry],
      ["Omschrijving", p.description],
      ["Website", p.website],
      [
        "Producten of diensten",
        p.products ||
          (p.productList || [])
            .filter((x) => x.active)
            .map((x) => x.name)
            .join(", "),
      ],
      ["Wat je uniek maakt", s.usps],
    ],
    2: [
      [
        "Doelgroep",
        p.audience || (p.segments || []).map((x) => x.name).join(", "),
      ],
      ["Interesses", s.audienceInterests],
      ["Taal", languageLabel(s.language)],
      [
        "Toon",
        tone ? `${tone.label} · ${v.formality} · emoji's: ${v.emojiUsage}` : "",
      ],
      ["Persoonlijkheid", s.personality.join(", ")],
      ["Vermijden", v.avoidWords],
    ],
    3: [
      ["Logo", p.logo ? "Geüpload" : ""],
      ["Kleuren", v.colors.filter((c) => HEX.test(c)).join(", ")],
      ["Ontwerpstijl", s.designStyles.join(", ")],
      [
        "Lettertypes",
        [font(s.typography.heading), font(s.typography.body)]
          .filter(Boolean)
          .join(" / "),
      ],
      ["Bedrijfsfoto's", p.media?.length ? `${p.media.length} foto's` : ""],
      [
        "Inspiratiebeelden",
        s.referenceImages.length ? `${s.referenceImages.length} beelden` : "",
      ],
    ],
    4: [
      ["Hoofddoel", objectiveLabel(s.objective)],
      ["Kanalen", s.channels.filter((c) => CHANNELS.includes(c)).join(", ")],
      ["Call-to-action", s.ctas.join(", ")],
      ["Bedrijfsdoelen", s.businessGoals],
      ["Marketingvoorkeuren", p.contentPreferences || ""],
      ["Aanbiedingen", p.offers || ""],
    ],
  };
}

function Summary({
  profile,
  onEdit,
  onFinish,
  busy,
}: {
  profile: Profile;
  onEdit: (s: number) => void;
  onFinish: () => void;
  busy: boolean;
}) {
  const r = rows(profile);
  const c = completion(profile);
  return (
    <>
      <header className="bh-panel-head">
        <span className="bh-panel-icon" aria-hidden="true">
          <Check size={18} />
        </span>
        <div>
          <small>{c.percent}% compleet</small>
          <h2 id="bh-step-title">Je merk in het kort</h2>
        </div>
      </header>
      <p className="bh-hint">
        Controleer of alles klopt. Je kunt elke stap later altijd aanpassen.
      </p>
      <div className="bh-summary">
        {STEPS.map((st) => (
          <section key={st.id}>
            <header>
              <h3>{st.title}</h3>
              <button
                type="button"
                className="bh-link"
                onClick={() => onEdit(st.id)}
              >
                <Pencil size={13} aria-hidden="true" /> Bewerken
              </button>
            </header>
            <dl>
              {r[st.id].map(([k, val]) => (
                <div key={k} className={val ? "" : "is-empty"}>
                  <dt>{k}</dt>
                  <dd>{val || "Nog niet ingevuld"}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <footer className="bh-actions">
        <button
          type="button"
          className="button secondary"
          onClick={() => onEdit(4)}
          disabled={busy}
        >
          <ArrowLeft size={15} aria-hidden="true" /> Vorige
        </button>
        <span />
        <button
          type="button"
          className="button primary"
          onClick={onFinish}
          disabled={busy}
        >
          {busy ? "Opslaan…" : "Afronden"}{" "}
          <Check size={15} aria-hidden="true" />
        </button>
      </footer>
    </>
  );
}

function Overview({
  profile,
  onEdit,
}: {
  profile: Profile;
  onEdit: (s: number) => void;
}) {
  const r = rows(profile);
  const c = completion(profile);
  return (
    <>
      <div className="bh-overview">
        <section className="ui-card bh-overview-hero">
          <div>
            <h2>{profile.name || "Je merk"}</h2>
            <p>
              {profile.description ||
                "Vertel in Brand Hub wat je bedrijf doet, zodat Mavi in jouw stem kan schrijven."}
            </p>
            {c.percent < 100 && (
              <p className="bh-hint">
                Nog aan te vullen:{" "}
                {c.perStep
                  .flatMap((s) => s.missing)
                  .slice(0, 4)
                  .join(", ")}
                {c.perStep.flatMap((s) => s.missing).length > 4
                  ? " en meer"
                  : ""}
                .
              </p>
            )}
            <ul className="bh-mini">
              {STEPS.map((st) => {
                const ps = c.perStep[st.id - 1];
                return (
                  <li key={st.id}>
                    <button type="button" onClick={() => onEdit(st.id)}>
                      <span>{st.title}</span>
                      <span className="bh-mini-bar" aria-hidden="true">
                        <span
                          style={{ width: (ps.filled / ps.total) * 100 + "%" }}
                        />
                      </span>
                      <small>
                        {ps.filled}/{ps.total}
                      </small>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <BrandPreview profile={profile} compact />
        </section>
        <div className="bh-cards">
          {STEPS.map((st) => {
            const Icon = ICONS[st.id - 1];
            const ps = c.perStep[st.id - 1];
            return (
              <section key={st.id} className="ui-card bh-card">
                <header>
                  <span className="bh-panel-icon" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  <div>
                    <h3>{st.title}</h3>
                    <small>
                      {ps.filled} van {ps.total} ingevuld
                    </small>
                  </div>
                  <button
                    type="button"
                    className="button secondary bh-card-edit"
                    onClick={() => onEdit(st.id)}
                  >
                    Bewerken
                  </button>
                </header>
                <dl>
                  {r[st.id]
                    .filter(([, v]) => v)
                    .slice(0, 4)
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                </dl>
                {!r[st.id].some(([, v]) => v) && (
                  <p className="bh-hint">Nog niets ingevuld.</p>
                )}
              </section>
            );
          })}
        </div>
      </div>
      <section className="bh-deep">
        <h2>
          <ImageIcon size={16} aria-hidden="true" /> Verdieping
        </h2>
        <p className="bh-hint">
          Doelgroepsegmenten en productkaarten geven Mavi nog meer houvast,
          bijvoorbeeld voor posts over één product of één klantgroep.
        </p>
        <SegmentsManager />
        <ProductsManager />
        <WebsiteImport />
      </section>
    </>
  );
}
