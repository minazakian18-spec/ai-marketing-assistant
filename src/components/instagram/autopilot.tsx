"use client";
import { SettingsGroup } from "@/components/channel/workspace-ui";
import { useState, useRef } from "react";
import { Save, Play, ShieldCheck, Plane, CalendarClock } from "lucide-react";
import type { Profile } from "@/lib/types";
import {
  mixLabels,
  allowedLabels,
  forbiddenLabels,
  rebalanceMix,
  settingsError,
  effectivePolicy,
  type InstagramSettings,
  type Frequency,
} from "@/lib/instagram-model";
import { Toggle } from "./shared";
import { BrandReadiness } from "./readiness";
function Frequencies({
  value,
  onChange,
  prefix = "",
}: {
  value: Frequency;
  onChange: (f: Frequency) => void;
  prefix?: string;
}) {
  return (
    <div className="ig-frequency">
      {(["posts", "stories", "reels"] as const).map((key) => (
        <label key={key}>
          {prefix}
          {key === "posts"
            ? "Posts"
            : key === "stories"
              ? "Stories"
              : "Reels"}{" "}
          per week
          <input
            type="number"
            min={0}
            max={14}
            required
            value={value[key]}
            onChange={(e) =>
              onChange({
                ...value,
                [key]: e.target.value === "" ? 0 : Number(e.target.value),
              })
            }
          />
        </label>
      ))}
    </div>
  );
}
export function AutopilotSettings({
  settings,
  pageMode,
  profile,
  onSave,
  onRun,
  busy,
}: {
  settings: InstagramSettings;
  pageMode: "auto" | "full";
  profile: Profile;
  onSave: (s: InstagramSettings) => boolean;
  onRun: (s: InstagramSettings) => Promise<void>;
  busy: boolean;
}) {
  const [form, setForm] = useState<InstagramSettings>(() => ({
    ...structuredClone(settings),
    mode: pageMode,
    enabled: settings.mode === pageMode && settings.enabled,
  }));
  const [message, setMessage] = useState("");
  const ref = useRef<HTMLFormElement>(null);
  const update = (part: Partial<InstagramSettings>) => {
    setForm({ ...form, ...part });
    setMessage("");
  };
  const policy = effectivePolicy(form, new Date());
  return (
    <div className="ig-autopilot-grid">
      <form
        ref={ref}
        onInvalidCapture={(e) => {
          let element: HTMLElement | null = e.target as HTMLElement;
          while (element) {
            if (element instanceof HTMLDetailsElement) element.open = true;
            element = element.parentElement;
          }
        }}
        className="ig-settings"
        onSubmit={(e) => {
          e.preventDefault();
          const error = settingsError(form);
          if (error) {
            setMessage(error);
            return;
          }
          if (onSave(form)) setMessage("Autopilot-instellingen opgeslagen.");
        }}
      >
        <section className="panel ig-settings-card">
          <div className="ig-card-head">
            <div>
              <h2>{pageMode === "full" ? "Full Autopilot" : "Auto Create"}</h2>
              <p>Jouw ritme. Jouw regels.</p>
            </div>
            <span
              className={
                "badge " +
                (form.enabled && form.mode !== "assist" ? "approved" : "draft")
              }
            >
              {form.enabled && form.mode !== "assist"
                ? "Actief"
                : "Uitgeschakeld"}
            </span>
          </div>
          <p className="field-note">
            Opslaan gebruikt deze modus en vervangt de actieve instellingen. Je
            huidige frequentie, regels en merkgegevens blijven bewaard.
          </p>
          <Toggle
            label="Autopilot activeren"
            checked={form.enabled}
            onChange={(enabled) =>
              update({
                enabled,
                mode: pageMode,
              })
            }
          />
          {pageMode === "full" && (
            <p className="channel-publication-status">
              Automatisch publiceren:{" "}
              <strong>{form.enabled ? "AAN" : "UIT"}</strong>{" "}
              <small>(simulatie · na opslaan)</small>
            </p>
          )}
          <p className="field-note">
            {pageMode === "auto"
              ? "Mavix maakt automatisch Instagram-content volgens jouw schema. Jij keurt goed voordat iets wordt gepubliceerd."
              : "Mavix bedenkt, maakt, plant en publiceert zelfstandig binnen jouw ingestelde regels."}
          </p>
          <p className="field-note">
            Alleen een lokale simulatie. Er draait geen achtergrondtaak en er
            wordt niets echt gepubliceerd.
          </p>
        </section>
        <section className="panel ig-settings-card">
          <div className="ig-card-head">
            <h2>
              <CalendarClock size={18} />
              Contentfrequentie
            </h2>
          </div>
          <Frequencies
            value={form.frequency}
            onChange={(frequency) => update({ frequency })}
          />
          <fieldset className="ig-days">
            <legend>Dagen en tijden</legend>
            {["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"].map((day, index) => (
              <div key={day}>
                <label>
                  <input
                    type="checkbox"
                    checked={form.days.includes(index)}
                    onChange={(e) =>
                      update({
                        days: e.target.checked
                          ? [...form.days, index].sort()
                          : form.days.filter((d) => d !== index),
                      })
                    }
                  />
                  {day}
                </label>
                {form.days.includes(index) && (
                  <input
                    aria-label={"Tijd " + day}
                    type="time"
                    required
                    disabled={form.bestTimes}
                    value={form.times[String(index)]}
                    onChange={(e) =>
                      update({
                        times: {
                          ...form.times,
                          [String(index)]: e.target.value,
                        },
                      })
                    }
                  />
                )}
              </div>
            ))}
          </fieldset>
          <Toggle
            label="Laat Mavix de beste tijden kiezen"
            description="In deze demo gebruikt Mavix 18:00 als voorbeeldtijd."
            checked={form.bestTimes}
            onChange={(bestTimes) => update({ bestTimes })}
          />
        </section>
        <SettingsGroup
          title="Contentmix"
          description="Verdeel producten, reviews, tips en aanbiedingen."
        >
          <section className="panel ig-settings-card">
            <div className="ig-card-head">
              <h2>Contentmix</h2>
              <strong className="ig-total">
                {Object.values(form.mix).reduce((a, b) => a + b, 0)}%
              </strong>
            </div>
            <div className="ig-mix-bar" aria-hidden="true">
              {Object.keys(mixLabels).map((k, i) => (
                <span
                  key={k}
                  style={{ width: form.mix[k] + "%", opacity: 1 - i * 0.15 }}
                />
              ))}
            </div>
            {Object.entries(mixLabels).map(([key, label]) => (
              <label className="ig-slider" key={key}>
                <span>
                  {label}
                  <strong>{form.mix[key]}%</strong>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={form.mix[key]}
                  onChange={(e) =>
                    update({
                      mix: rebalanceMix(form.mix, key, Number(e.target.value)),
                    })
                  }
                />
              </label>
            ))}
            <p className="field-note">
              Mavix gebruikt deze verdeling als richtlijn en houdt rekening met
              eerder geplaatste content om herhaling te voorkomen. In deze demo
              worden de overige percentages automatisch herverdeeld;
              inhoudelijke optimalisatie volgt later.
            </p>
          </section>
        </SettingsGroup>
        <SettingsGroup
          title="Regels & veiligheid"
          description="Toegestane onderwerpen en handelen bij twijfel."
        >
          <section className="panel ig-settings-card">
            <div className="ig-card-head">
              <h2>
                <ShieldCheck size={18} />
                Autopilot rules
              </h2>
            </div>
            <div className="ig-rules">
              <fieldset>
                <legend>Mavix mag</legend>
                {Object.entries(allowedLabels).map(([key, label]) => (
                  <Toggle
                    key={key}
                    label={label}
                    checked={form.allowed[key]}
                    onChange={(v) =>
                      update({ allowed: { ...form.allowed, [key]: v } })
                    }
                  />
                ))}
              </fieldset>
              <fieldset>
                <legend>Mavix mag niet</legend>
                {Object.entries(forbiddenLabels).map(([key, label]) => (
                  <Toggle
                    key={key}
                    label={label}
                    checked={form.forbidden[key]}
                    disabled={key === "unknown"}
                    onChange={(v) =>
                      update({ forbidden: { ...form.forbidden, [key]: v } })
                    }
                  />
                ))}
              </fieldset>
            </div>
            <label>
              Bij twijfel
              <select
                value={form.uncertain}
                onChange={(e) =>
                  update({ uncertain: e.target.value as "review" | "skip" })
                }
              >
                <option value="review">
                  Concept maken en goedkeuring vragen
                </option>
                <option value="skip">Overslaan en melden</option>
              </select>
            </label>
            <p className="field-note">
              Onbekende feiten worden nooit verzonnen. De publicatiebeperking
              voor onbekende informatie staat altijd aan.
            </p>
          </section>
        </SettingsGroup>
        <SettingsGroup
          title="Vakantiemodus"
          description="Tijdelijk een ander ritme; daarna je vorige instellingen."
        >
          <section className="panel ig-settings-card ig-away">
            <div className="ig-card-head">
              <div>
                <h2>
                  <Plane size={18} />
                  Autopilot while I&apos;m away
                </h2>
                <p>Blijf zichtbaar, ook als je even offline bent.</p>
              </div>
            </div>
            <Toggle
              label="Vakantiemodus activeren"
              checked={form.vacation.enabled}
              onChange={(enabled) =>
                update({ vacation: { ...form.vacation, enabled } })
              }
            />
            {form.vacation.enabled && (
              <>
                <div className="ig-two-fields">
                  <label>
                    Away from
                    <input
                      type="date"
                      required
                      value={form.vacation.from}
                      onChange={(e) =>
                        update({
                          vacation: { ...form.vacation, from: e.target.value },
                        })
                      }
                    />
                  </label>
                  <label>
                    Until
                    <input
                      type="date"
                      required
                      min={form.vacation.from}
                      value={form.vacation.until}
                      onChange={(e) =>
                        update({
                          vacation: { ...form.vacation, until: e.target.value },
                        })
                      }
                    />
                  </label>
                </div>
                <Frequencies
                  prefix="Vakantie: "
                  value={form.vacation.frequency}
                  onChange={(frequency) =>
                    update({ vacation: { ...form.vacation, frequency } })
                  }
                />
                <label>
                  Publicatie
                  <select
                    value={form.vacation.publication}
                    onChange={(e) =>
                      update({
                        vacation: {
                          ...form.vacation,
                          publication: e.target.value as "review" | "automatic",
                        },
                      })
                    }
                  >
                    <option value="review">Eerst goedkeuren</option>
                    <option value="automatic">Automatisch publiceren</option>
                  </select>
                </label>
                <Toggle
                  label="Notificatie na iedere publicatie"
                  checked={form.vacation.notify}
                  onChange={(notify) =>
                    update({ vacation: { ...form.vacation, notify } })
                  }
                />
                <p className="field-note">
                  Na einddatum: terug naar vorige Autopilot-instelling.{" "}
                  {policy.away
                    ? "Vakantieregels gelden nu."
                    : "Vakantieregels gelden alleen binnen de gekozen datums."}{" "}
                  Notificaties en publicatie worden niet echt uitgevoerd.
                </p>
              </>
            )}
          </section>
        </SettingsGroup>
        <div className="ig-settings-footer">
          <p role="status">{message}</p>
          <button className="button primary" disabled={busy}>
            <Save size={16} />
            Instellingen opslaan
          </button>
        </div>
      </form>
      <aside>
        <BrandReadiness profile={profile} />
        <section className="panel ig-simulate">
          <h2>Probeer je Autopilot</h2>
          <p>
            Simuleer één week met de instellingen hiernaast. Auto Create maakt
            concepten voor de goedkeuringswachtrij. Full Autopilot plant
            mockcontent in, tenzij informatie ontbreekt.
          </p>
          <button
            disabled={busy || !form.enabled || form.mode === "assist"}
            className="button primary full"
            onClick={() => {
              if (!ref.current?.reportValidity()) return;
              const error = settingsError(form);
              if (error) {
                setMessage(error);
                return;
              }
              void onRun(form);
            }}
          >
            <Play size={16} />
            {busy ? "Simulatie maken…" : "Simuleer volgende week"}
          </button>
          <small>Iedere klik maakt een nieuwe lokale voorbeeldbatch.</small>
        </section>
      </aside>
    </div>
  );
}
