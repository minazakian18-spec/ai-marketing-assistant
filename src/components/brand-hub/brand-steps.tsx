"use client";
import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  Check,
  ImagePlus,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { Profile } from "@/lib/types";
import type { BrandVoice } from "@/lib/brand-model";
import {
  CHANNELS,
  CTA_SUGGESTIONS,
  DESIGN_STYLES,
  HEX,
  LANGUAGES,
  OBJECTIVES,
  PERSONALITY,
  TONE_PRESETS,
  TYPOGRAPHY,
  strategyOf,
  voiceOf,
  type BrandStrategy,
} from "@/lib/brand-strategy";
import { prepareImage } from "@/lib/image-prep";
import { BrandPreview, type PreviewText } from "./brand-preview";

// The four Brand Hub steps. Every field writes straight into the draft
// profile; saving happens in brand-hub.tsx.

export type StepProps = {
  profile: Profile;
  errors: Record<string, string>;
  setProfile: (patch: Partial<Profile>) => void;
  setStrategy: (patch: Partial<BrandStrategy>) => void;
  setVoice: (patch: Partial<BrandVoice>) => void;
};

function Field({
  label,
  hint,
  error,
  children,
  optional,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  optional?: boolean;
}) {
  const id = useId();
  return (
    <div className={"bh-field" + (error ? " has-error" : "")}>
      <label htmlFor={id}>
        <span className="bh-label">
          {label}
          {optional && <small> (optioneel)</small>}
        </span>
        {isValidElement(children)
          ? cloneElement(children as ReactElement<Record<string, unknown>>, {
              id,
              "aria-invalid": !!error,
              "aria-describedby": hint || error ? `${id}-help` : undefined,
            })
          : children}
      </label>
      {hint && !error && (
        <p id={`${id}-help`} className="bh-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-help`} className="bh-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Chips({
  options,
  value,
  onChange,
  max,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
}) {
  return (
    <div className="bh-chips">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            disabled={!on && !!max && value.length >= max}
            onClick={() =>
              onChange(on ? value.filter((x) => x !== o) : [...value, o])
            }
          >
            {on && <Check size={13} aria-hidden="true" />}
            {o}
          </button>
        );
      })}
    </div>
  );
}

/** "Verbeter met Mavi": suggestion for the owner's own text; kept only when accepted. */
function Improve({
  field,
  text,
  profile,
  onAccept,
}: {
  field: "description" | "usps" | "audience";
  text: string;
  profile: Profile;
  onAccept: (v: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [error, setError] = useState("");
  async function run() {
    setBusy(true);
    setError("");
    setSuggestion("");
    try {
      const s = strategyOf(profile);
      const r = await fetch("/api/brand/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field,
          text,
          profile: {
            name: profile.name,
            industry: profile.industry,
            description: profile.description,
            audience: profile.audience,
            voice: profile.voice,
            brandVoice: voiceOf(profile),
            strategy: {
              usps: s.usps,
              audienceInterests: s.audienceInterests,
              language: s.language,
              tonePreset: s.tonePreset,
              personality: s.personality,
            },
          },
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Mavi kon geen voorstel maken.");
      setSuggestion(d.suggestion);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Mavi kon geen voorstel maken.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="bh-improve">
      <button
        type="button"
        className="bh-improve-btn"
        onClick={() => void run()}
        disabled={busy || text.trim().length < 10}
      >
        {busy ? (
          <Loader2 size={13} className="bh-spin" aria-hidden="true" />
        ) : (
          <Sparkles size={13} aria-hidden="true" />
        )}
        Verbeter met Mavi
      </button>
      {error && <p className="bh-error">{error}</p>}
      {suggestion && (
        <div className="bh-suggestion" role="status">
          <p>{suggestion}</p>
          <div>
            <button
              type="button"
              className="button primary"
              onClick={() => {
                onAccept(suggestion);
                setSuggestion("");
              }}
            >
              Overnemen
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setSuggestion("")}
            >
              Houd mijn tekst
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Step 1

export function StepIdentity({
  profile,
  errors,
  setProfile,
  setStrategy,
}: StepProps) {
  const s = strategyOf(profile);
  return (
    <div className="bh-fields">
      <div className="bh-two">
        <Field label="Bedrijfsnaam" error={errors.name}>
          <input
            value={profile.name}
            maxLength={160}
            onChange={(e) => setProfile({ name: e.target.value })}
            placeholder="Bijvoorbeeld: Trattoria Gouda"
          />
        </Field>
        <Field label="Branche" error={errors.industry}>
          <input
            value={profile.industry}
            maxLength={300}
            onChange={(e) => setProfile({ industry: e.target.value })}
            placeholder="Bijvoorbeeld: Italiaans restaurant"
          />
        </Field>
      </div>
      <Field
        label="Wat doet je bedrijf?"
        error={errors.description}
        hint="Schrijf het zoals je het een nieuwe klant zou vertellen: wat je aanbiedt, voor wie en wat het bijzonder maakt."
      >
        <textarea
          rows={4}
          maxLength={3000}
          value={profile.description}
          onChange={(e) => setProfile({ description: e.target.value })}
          placeholder="Bijvoorbeeld: Familierestaurant in hartje Gouda met verse pasta, houtoven-pizza's en een terras aan de gracht."
        />
      </Field>
      <Improve
        field="description"
        text={profile.description}
        profile={profile}
        onAccept={(v) => setProfile({ description: v })}
      />
      <Field label="Website" optional error={errors.website}>
        <input
          type="url"
          value={profile.website}
          maxLength={300}
          onChange={(e) => setProfile({ website: e.target.value })}
          placeholder="https://jouwbedrijf.nl"
        />
      </Field>
      <Field
        label="Belangrijkste producten of diensten"
        optional
        hint="Eén per regel. Uitgebreide productkaarten beheer je onder 'Verdieping' in het overzicht."
      >
        <textarea
          rows={3}
          maxLength={3000}
          value={profile.products || ""}
          onChange={(e) => setProfile({ products: e.target.value })}
          placeholder={
            "Verse pasta\nPizza uit de houtoven\nCatering voor bedrijven"
          }
        />
      </Field>
      <Field
        label="Wat maakt jou anders dan anderen?"
        optional
        hint="Je unieke kenmerken (USP's). Mavi gebruikt ze om je content onderscheidend te maken."
      >
        <textarea
          rows={3}
          maxLength={2000}
          value={s.usps}
          onChange={(e) => setStrategy({ usps: e.target.value })}
          placeholder={
            "Pasta elke ochtend vers gemaakt\nTerras aan de gracht\nAl 25 jaar familiebedrijf"
          }
        />
      </Field>
      <Improve
        field="usps"
        text={s.usps}
        profile={profile}
        onAccept={(v) => setStrategy({ usps: v })}
      />
    </div>
  );
}

// ---------------------------------------------------------------- Step 2

export function StepVoice({
  profile,
  errors,
  setProfile,
  setStrategy,
  setVoice,
  ai,
  onPreview,
  previewBusy,
  previewError,
}: StepProps & {
  ai: PreviewText;
  onPreview: () => void;
  previewBusy: boolean;
  previewError: string;
}) {
  const s = strategyOf(profile);
  const v = voiceOf(profile);
  return (
    <div className="bh-fields">
      <Field
        label="Wie is je klant?"
        error={errors.audience}
        hint="Beschrijf je doelgroep alsof je één klant voor je ziet."
      >
        <textarea
          rows={3}
          maxLength={1000}
          value={profile.audience}
          onChange={(e) => setProfile({ audience: e.target.value })}
          placeholder="Bijvoorbeeld: Gezinnen en stellen uit Gouda en omgeving die graag ontspannen uit eten gaan."
        />
      </Field>
      <Improve
        field="audience"
        text={profile.audience}
        profile={profile}
        onAccept={(v2) => setProfile({ audience: v2 })}
      />
      <div className="bh-two">
        <Field label="Waar zijn je klanten in geïnteresseerd?" optional>
          <input
            value={s.audienceInterests}
            maxLength={1000}
            onChange={(e) => setStrategy({ audienceInterests: e.target.value })}
            placeholder="Lekker eten, gezelligheid, lokale producten"
          />
        </Field>
        <Field label="Taal van je content">
          <select
            value={s.language}
            onChange={(e) => setStrategy({ language: e.target.value })}
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className={"bh-field" + (errors.tonePreset ? " has-error" : "")}>
        <span className="bh-label">Toon</span>
        <div className="bh-tones" role="group" aria-label="Toon">
          {TONE_PRESETS.map((t) => (
            <button
              key={t.id}
              type="button"

              aria-pressed={s.tonePreset === t.id}
              className="bh-tone"
              onClick={() => {
                setStrategy({ tonePreset: t.id });
                setProfile({ voice: t.voice });
                setVoice({ formality: t.formality, emojiUsage: t.emoji });
              }}
            >
              <strong>{t.label}</strong>
              <span>{t.description}</span>
            </button>
          ))}
        </div>
        {errors.tonePreset && <p className="bh-error">{errors.tonePreset}</p>}
      </div>
      <div className="bh-field">
        <span className="bh-label">
          Merkpersoonlijkheid <small>(kies er maximaal 4)</small>
        </span>
        <Chips
          options={PERSONALITY}
          value={s.personality}
          max={4}
          onChange={(personality) => setStrategy({ personality })}
        />
      </div>
      <div className="bh-two">
        <Field label="Aanspreekvorm">
          <select
            value={v.formality}
            onChange={(e) =>
              setVoice({ formality: e.target.value as BrandVoice["formality"] })
            }
          >
            <option value="formeel">Formeel (u)</option>
            <option value="neutraal">Neutraal</option>
            <option value="informeel">Informeel (je)</option>
          </select>
        </Field>
        <Field label="Emoji's">
          <select
            value={v.emojiUsage}
            onChange={(e) =>
              setVoice({
                emojiUsage: e.target.value as BrandVoice["emojiUsage"],
              })
            }
          >
            <option value="geen">Geen</option>
            <option value="af en toe">Af en toe</option>
            <option value="veel">Veel</option>
          </select>
        </Field>
      </div>
      <div className="bh-two">
        <Field label="Woorden die bij je passen" optional>
          <input
            value={v.preferredWords}
            maxLength={500}
            onChange={(e) => setVoice({ preferredWords: e.target.value })}
            placeholder="vers, huisgemaakt, gastvrij"
          />
        </Field>
        <Field
          label="Woorden of uitdrukkingen om te vermijden"
          optional
          hint="Mavi gebruikt deze woorden nooit."
        >
          <input
            value={v.avoidWords}
            maxLength={500}
            onChange={(e) => setVoice({ avoidWords: e.target.value })}
            placeholder="goedkoop, budget, 'de beste van Nederland'"
          />
        </Field>
      </div>
      <div className="bh-tone-preview">
        <div className="bh-tone-preview-head">
          <div>
            <strong>Zo klinkt je merk</strong>
            <p>Laat Mavi een voorbeeld schrijven met deze instellingen.</p>
          </div>
          <button
            type="button"
            className="button secondary"
            onClick={onPreview}
            disabled={previewBusy || !s.tonePreset}
          >
            {previewBusy ? (
              <Loader2 size={14} className="bh-spin" aria-hidden="true" />
            ) : (
              <Sparkles size={14} aria-hidden="true" />
            )}
            {ai ? "Nieuw voorbeeld" : "Voorbeeld schrijven"}
          </button>
        </div>
        {previewError && <p className="bh-error">{previewError}</p>}
        <BrandPreview profile={profile} ai={ai} compact />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Step 3

function ImageList({
  images,
  max,
  onChange,
  label,
  maxSide,
}: {
  images: string[];
  max: number;
  onChange: (v: string[]) => void;
  label: string;
  maxSide: number;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="bh-images">
      {images.map((src, i) => (
        <figure key={i}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`${label} ${i + 1}`} />
          <button
            type="button"
            aria-label={`Verwijder ${label.toLowerCase()} ${i + 1}`}
            onClick={() => onChange(images.filter((_, j) => j !== i))}
          >
            <X size={13} />
          </button>
        </figure>
      ))}
      {images.length < max && (
        <label className="bh-image-add">
          {busy ? (
            <Loader2 size={18} className="bh-spin" aria-hidden="true" />
          ) : (
            <ImagePlus size={18} aria-hidden="true" />
          )}
          <span>Toevoegen</span>
          <input
            type="file"
            disabled={busy}
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            onChange={async (e) => {
              const files = Array.from(e.target.files || []).slice(
                0,
                max - images.length,
              );
              e.target.value = "";
              setError("");
              setBusy(true);
              try {
                const out: string[] = [];
                for (const f of files)
                  out.push(await prepareImage(f, { maxSide }));
                onChange([...images, ...out]);
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Uploaden is niet gelukt.",
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      )}
      {error && <p className="bh-error">{error}</p>}
    </div>
  );
}

export function StepVisual({
  profile,
  errors,
  setProfile,
  setStrategy,
  setVoice,
}: StepProps) {
  const s = strategyOf(profile);
  const v = voiceOf(profile);
  const [logoError, setLogoError] = useState("");
  const colors = [v.colors[0] || "", v.colors[1] || ""];
  const setColor = (i: number, value: string) => {
    const next = [...colors];
    next[i] = value;
    setVoice({ colors: next.filter((c, j) => c || j < next.length - 1) });
  };
  return (
    <div className="bh-fields">
      <div className="bh-field">
        <span className="bh-label">Logo</span>
        <div className="bh-logo">
          <span className="bh-logo-box">
            {profile.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.logo} alt="Je logo" />
            ) : (
              <ImagePlus size={20} aria-hidden="true" />
            )}
          </span>
          <div>
            <label className="button secondary bh-file">
              {profile.logo ? "Ander logo kiezen" : "Logo uploaden"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setLogoError("");
                  try {
                    setProfile({
                      logo: await prepareImage(f, {
                        maxSide: 512,
                        keepPng: true,
                      }),
                    });
                  } catch (err) {
                    setLogoError(
                      err instanceof Error
                        ? err.message
                        : "Uploaden is niet gelukt.",
                    );
                  }
                }}
              />
            </label>
            {profile.logo && (
              <button
                type="button"
                className="bh-link"
                onClick={() => setProfile({ logo: "" })}
              >
                <Trash2 size={13} aria-hidden="true" /> Verwijderen
              </button>
            )}
            <p className="bh-hint">
              PNG (met transparantie), JPG of WebP. We verkleinen het bestand
              automatisch.
            </p>
            {logoError && <p className="bh-error">{logoError}</p>}
          </div>
        </div>
      </div>
      <div className={"bh-field" + (errors.colors ? " has-error" : "")}>
        <span className="bh-label">Merkkleuren</span>
        <div className="bh-colors">
          {["Hoofdkleur", "Tweede kleur"].map((label, i) => (
            <label key={label} className="bh-color">
              <input
                type="color"
                value={
                  HEX.test(colors[i]) ? colors[i] : i ? "#f3effd" : "#6d28d9"
                }
                onChange={(e) => setColor(i, e.target.value)}
                aria-label={label + " kiezen"}
              />
              <span>
                <small>{label}</small>
                <input
                  value={colors[i]}
                  maxLength={7}
                  placeholder={i ? "#F3EFFD" : "#6D28D9"}
                  onChange={(e) => setColor(i, e.target.value.trim())}
                  aria-label={label + " als kleurcode"}
                />
              </span>
            </label>
          ))}
        </div>
        {errors.colors && <p className="bh-error">{errors.colors}</p>}
      </div>
      <div className="bh-field">
        <span className="bh-label">
          Ontwerpstijl <small>(maximaal 3)</small>
        </span>
        <Chips
          options={DESIGN_STYLES}
          value={s.designStyles}
          max={3}
          onChange={(designStyles) => setStrategy({ designStyles })}
        />
      </div>
      <div className="bh-two">
        <Field label="Lettertype voor koppen" optional>
          <select
            value={s.typography.heading}
            onChange={(e) =>
              setStrategy({
                typography: { ...s.typography, heading: e.target.value },
              })
            }
          >
            <option value="">Geen voorkeur</option>
            {TYPOGRAPHY.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Lettertype voor tekst" optional>
          <select
            value={s.typography.body}
            onChange={(e) =>
              setStrategy({
                typography: { ...s.typography, body: e.target.value },
              })
            }
          >
            <option value="">Zelfde als koppen</option>
            {TYPOGRAPHY.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        label="Beschrijf je beeldstijl"
        optional
        hint="Bijvoorbeeld: natuurlijk licht, houten tafels, mensen die samen eten."
      >
        <input
          value={v.marketingStyle}
          maxLength={500}
          onChange={(e) => setVoice({ marketingStyle: e.target.value })}
        />
      </Field>
      <div className="bh-field">
        <span className="bh-label">
          Bedrijfsfoto&apos;s <small>(maximaal 12)</small>
        </span>
        <p className="bh-hint">
          Eigen foto&apos;s van je zaak, producten en team. Nodig voor
          automatische Instagram-content (minimaal 3).
        </p>
        <ImageList
          images={profile.media || []}
          max={12}
          maxSide={1200}
          label="Bedrijfsfoto"
          onChange={(media) => setProfile({ media })}
        />
      </div>
      <div className="bh-field">
        <span className="bh-label">
          Inspiratiebeelden <small>(maximaal 6)</small>
        </span>
        <p className="bh-hint">
          Beelden waarvan je de stijl mooi vindt. Bewaar ze als referentie voor
          je huisstijl; ze worden niet naar de tekst-AI gestuurd.
        </p>
        <ImageList
          images={s.referenceImages}
          max={6}
          maxSide={800}
          label="Inspiratiebeeld"
          onChange={(referenceImages) => setStrategy({ referenceImages })}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Step 4

export function StepGoals({
  profile,
  errors,
  setProfile,
  setStrategy,
}: StepProps) {
  const s = strategyOf(profile);
  const [cta, setCta] = useState("");
  const addCta = (value: string) => {
    const t = value.trim().slice(0, 60);
    if (t && !s.ctas.includes(t) && s.ctas.length < 6)
      setStrategy({ ctas: [...s.ctas, t] });
    setCta("");
  };
  return (
    <div className="bh-fields">
      <div className={"bh-field" + (errors.objective ? " has-error" : "")}>
        <span className="bh-label">Wat is nu je belangrijkste doel?</span>
        <div
          className="bh-objectives"
          role="group"
          aria-label="Belangrijkste doel"
        >
          {OBJECTIVES.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={s.objective === o.id}
              className="bh-objective"
              onClick={() => setStrategy({ objective: o.id })}
            >
              <strong>{o.label}</strong>
              <span>{o.description}</span>
            </button>
          ))}
        </div>
        {errors.objective && <p className="bh-error">{errors.objective}</p>}
      </div>
      <div className="bh-field">
        <span className="bh-label">Op welke kanalen ben je actief?</span>
        <Chips
          options={CHANNELS}
          value={s.channels}
          onChange={(channels) => setStrategy({ channels })}
        />
      </div>
      <div className="bh-field">
        <span className="bh-label">
          Wat wil je dat klanten doen?{" "}
          <small>(call-to-action, maximaal 6)</small>
        </span>
        <div className="bh-chips">
          {s.ctas.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed="true"
              onClick={() =>
                setStrategy({ ctas: s.ctas.filter((x) => x !== c) })
              }
              aria-label={`${c} verwijderen`}
            >
              {c} <X size={12} aria-hidden="true" />
            </button>
          ))}
          {CTA_SUGGESTIONS.filter((c) => !s.ctas.includes(c)).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed="false"
              className="is-suggestion"
              disabled={s.ctas.length >= 6}
              onClick={() => addCta(c)}
            >
              <Plus size={12} aria-hidden="true" /> {c}
            </button>
          ))}
        </div>
        <div className="bh-inline-add">
          <input
            value={cta}
            maxLength={60}
            placeholder="Eigen call-to-action"
            onChange={(e) => setCta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCta(cta);
              }
            }}
          />
          <button
            type="button"
            className="button secondary"
            onClick={() => addCta(cta)}
            disabled={!cta.trim() || s.ctas.length >= 6}
          >
            Toevoegen
          </button>
        </div>
      </div>
      <Field
        label="Je bedrijfsdoelen"
        optional
        hint="Bijvoorbeeld: 20% meer reserveringen op doordeweekse avonden, of de cateringservice bekender maken."
      >
        <textarea
          rows={3}
          maxLength={2000}
          value={s.businessGoals}
          onChange={(e) => setStrategy({ businessGoals: e.target.value })}
        />
      </Field>
      <div className="bh-two">
        <Field
          label="Marketingvoorkeuren"
          optional
          hint="Onderwerpen die passen, of juist niet."
        >
          <textarea
            rows={3}
            maxLength={2000}
            value={profile.contentPreferences || ""}
            onChange={(e) => setProfile({ contentPreferences: e.target.value })}
            placeholder="Veel achter de schermen, geen politiek"
          />
        </Field>
        <Field
          label="Lopende aanbiedingen"
          optional
          hint="Eén per regel, met voorwaarden. Mavi verzint nooit zelf aanbiedingen."
        >
          <textarea
            rows={3}
            maxLength={2000}
            value={profile.offers || ""}
            onChange={(e) => setProfile({ offers: e.target.value })}
            placeholder="Dinsdag: pasta + glas wijn voor €19,50"
          />
        </Field>
      </div>
    </div>
  );
}
