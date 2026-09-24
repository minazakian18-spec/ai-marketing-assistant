"use client";
import { useEffect, useState } from "react";
import { Palette, Save, Plus, X } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import {
  defaultBrandVoice,
  type BrandVoice,
  type EmojiUsage,
  type Formality,
} from "@/lib/brand-model";

const emojiOptions: EmojiUsage[] = ["geen", "af en toe", "veel"];
const formalityOptions: Formality[] = ["formeel", "neutraal", "informeel"];

export function BrandVoiceForm() {
  const { data, ready, save } = useWorkspace();
  const stored = data.profile.brandVoice || defaultBrandVoice;
  const [form, setForm] = useState<BrandVoice>(stored);
  const [colorDraft, setColorDraft] = useState("#6D28D9");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (ready) setForm(data.profile.brandVoice || defaultBrandVoice);
  }, [ready, data.profile.brandVoice]);
  const dirty = ready && JSON.stringify(form) !== JSON.stringify(stored);

  return (
    <form
      className="panel brand-section"
      onSubmit={(e) => {
        e.preventDefault();
        if (save({ ...data, profile: { ...data.profile, brandVoice: form } }))
          setMessage("Merkstem opgeslagen.");
      }}
    >
      <div className="section-heading">
        <div>
          <h2>Merkstem</h2>
          <p>
            Bepaal hoe Mavix AI moet klinken: kleuren, woordkeuze en toon.
          </p>
        </div>
        <Palette size={22} />
      </div>
      <label>
        Merkkleuren
        <div className="brand-color-row">
          {form.colors.map((c, i) => (
            <span key={i} className="brand-color-chip" style={{ background: c }}>
              <button
                type="button"
                aria-label={"Verwijder kleur " + c}
                onClick={() =>
                  setForm({
                    ...form,
                    colors: form.colors.filter((_, n) => n !== i),
                  })
                }
              >
                <X size={11} />
              </button>
            </span>
          ))}
          <input
            type="color"
            value={colorDraft}
            onChange={(e) => setColorDraft(e.target.value)}
            aria-label="Nieuwe merkkleur kiezen"
          />
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              if (!form.colors.includes(colorDraft))
                setForm({ ...form, colors: [...form.colors, colorDraft] });
            }}
          >
            <Plus size={14} /> Kleur toevoegen
          </button>
        </div>
      </label>
      <div className="ig-two-fields">
        <label>
          Emoji-gebruik
          <select
            value={form.emojiUsage}
            onChange={(e) =>
              setForm({ ...form, emojiUsage: e.target.value as EmojiUsage })
            }
          >
            {emojiOptions.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Formeel of informeel
          <select
            value={form.formality}
            onChange={(e) =>
              setForm({ ...form, formality: e.target.value as Formality })
            }
          >
            {formalityOptions.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="ig-two-fields">
        <label>
          Woorden die bij het merk passen
          <textarea
            value={form.preferredWords}
            rows={2}
            maxLength={500}
            placeholder="Bijvoorbeeld: eerlijk, warm, vakmanschap"
            onChange={(e) => setForm({ ...form, preferredWords: e.target.value })}
          />
        </label>
        <label>
          Woorden om te vermijden
          <textarea
            value={form.avoidWords}
            rows={2}
            maxLength={500}
            placeholder="Bijvoorbeeld: goedkoop, opdringerig"
            onChange={(e) => setForm({ ...form, avoidWords: e.target.value })}
          />
        </label>
      </div>
      <label>
        Marketingstijl
        <textarea
          value={form.marketingStyle}
          rows={2}
          maxLength={500}
          placeholder="Bijvoorbeeld: storytelling met korte, krachtige zinnen"
          onChange={(e) => setForm({ ...form, marketingStyle: e.target.value })}
        />
      </label>
      <div className="ig-settings-footer">
        <p role="status">{message || (dirty ? "Niet-opgeslagen wijzigingen." : "")}</p>
        <button className="button primary" disabled={!ready}>
          <Save size={16} />
          Merkstem opslaan
        </button>
      </div>
    </form>
  );
}
