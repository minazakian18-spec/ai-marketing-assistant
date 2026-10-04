"use client";
import { PenLine, Layers, Sparkles } from "lucide-react";
import type { ReviewAutoReplySettings, ResponseMode } from "@/lib/review-model";
import { responseModeName, responseModeDescription } from "@/lib/review-model";
import { Toggle } from "@/components/instagram/shared";

const modeIcons: Record<ResponseMode, typeof PenLine> = {
  assist: PenLine,
  auto: Layers,
};

export function ReviewAutoReply({
  settings,
  onChange,
  onSimulate,
  busy,
}: {
  settings: ReviewAutoReplySettings;
  onChange: (s: ReviewAutoReplySettings) => void;
  onSimulate: () => void;
  busy: boolean;
}) {
  return (
    <section>
      <div className="ig-section-title">
        <div>
          <h2>Welke modus gebruik je?</h2>
          <p>Bepaal hoeveel Mavix zelfstandig mag reageren op nieuwe reviews.</p>
        </div>
      </div>
      <div className="ig-mode-selector">
        {(["assist", "auto"] as const).map((m) => {
          const Icon = modeIcons[m];
          return (
            <button
              key={m}
              type="button"
              aria-pressed={settings.mode === m}
              onClick={() =>
                onChange({ ...settings, mode: m, enabled: m !== "assist" })
              }
            >
              <span>
                <Icon size={18} />
                {settings.mode === m && <span className="ig-active-dot" />}
              </span>
              <strong>{responseModeName(m)}</strong>
              <small>{responseModeDescription(m)}</small>
            </button>
          );
        })}
      </div>

      <div className="panel ig-settings-card">
        <div className="ig-card-head">
          <h2>Regels voor automatisch reageren</h2>
        </div>
        <Toggle
          label="Vraag per item toestemming"
          description="Aan: elke reactie komt eerst in de inbox ter goedkeuring. Uit: Mavix publiceert direct binnen je regels."
          checked={settings.requireApproval}
          onChange={(requireApproval) => onChange({ ...settings, requireApproval })}
        />
        <div className="rv-rules-grid">
          <div className="rv-slider-field">
            <div>
              <span>Automatisch publiceren vanaf</span>
              <strong>{settings.autoPublishMinRating}+ sterren</strong>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={settings.autoPublishMinRating}
              onChange={(e) =>
                onChange({
                  ...settings,
                  autoPublishMinRating: Number(e.target.value),
                })
              }
              disabled={settings.requireApproval}
            />
          </div>
          <div className="rv-slider-field">
            <div>
              <span>Altijd handmatig controleren onder</span>
              <strong>{settings.manualBelowRating} sterren</strong>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={settings.manualBelowRating}
              onChange={(e) =>
                onChange({
                  ...settings,
                  manualBelowRating: Number(e.target.value),
                })
              }
            />
          </div>
        </div>
        <label>
          Toon van de reacties
          <textarea
            value={settings.tone}
            onChange={(e) => onChange({ ...settings, tone: e.target.value })}
            rows={2}
          />
        </label>
        <label>
          Ondertekening
          <input
            value={settings.signature}
            onChange={(e) =>
              onChange({ ...settings, signature: e.target.value })
            }
          />
        </label>
        <div
          className="ig-toggle-row"
          role="button"
          tabIndex={0}
          onClick={() =>
            onChange({ ...settings, notifyOnLowRating: !settings.notifyOnLowRating })
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onChange({
                ...settings,
                notifyOnLowRating: !settings.notifyOnLowRating,
              });
            }
          }}
        >
          <div>
            <strong>Waarschuw bij lage beoordelingen</strong>
            <small>Krijg een melding zodra een review van 1 of 2 sterren binnenkomt.</small>
          </div>
          <input
            type="checkbox"
            checked={settings.notifyOnLowRating}
            onChange={(e) =>
              onChange({ ...settings, notifyOnLowRating: e.target.checked })
            }
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="ig-generate-footer">
          <span>Wijzigingen worden meteen opgeslagen.</span>
          <button
            className="button primary"
            onClick={onSimulate}
            aria-busy={busy || undefined}
            disabled={busy}
          >
            <Sparkles size={16} />
            Simuleer nieuwe reviews
          </button>
        </div>
      </div>
      <p className="field-note ig-bottom-note">
        Simulatie · er wordt niets gepubliceerd op Google Business
        Profile. Deze koppeling volgt in een latere stap.
      </p>
    </section>
  );
}
