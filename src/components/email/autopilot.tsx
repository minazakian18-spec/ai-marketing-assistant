"use client";
import { SettingsGroup } from "@/components/channel/workspace-ui";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  Save,
  Play,
  Plane,
  ShieldCheck,
  CalendarClock,
  Workflow,
} from "lucide-react";
import {
  emailMix,
  emailAllowed,
  emailForbidden,
  emailSettingsError,
  emailPolicy,
  type EmailSettings,
  type EmailCampaign,
} from "@/lib/email-model";
import { rebalanceMix } from "@/lib/instagram-model";
import { segments, recipients } from "@/lib/contact-data";
import type { Profile } from "@/lib/types";
import { Toggle } from "@/components/instagram/shared";
import { EmailReadiness } from "./shared";
export function EmailAutopilot({
  settings,
  profile,
  campaigns,
  onSave,
  onRun,
  busy,
}: {
  settings: EmailSettings;
  profile: Profile;
  campaigns: EmailCampaign[];
  onSave: (s: EmailSettings) => Promise<boolean>;
  onRun: (s: EmailSettings, workflow: boolean) => Promise<void>;
  busy: boolean;
}) {
  const [form, setForm] = useState<EmailSettings>(() => ({
    ...structuredClone(settings),
    mode: "auto",
    enabled: settings.mode === "auto" && settings.enabled,
  }));
  const [message, setMessage] = useState("");
  const ref = useRef<HTMLFormElement>(null);
  const update = (part: Partial<EmailSettings>) => {
    setForm({ ...form, ...part });
    setMessage("");
  };
  function valid() {
    if (!ref.current?.reportValidity()) return false;
    const error = emailSettingsError(form);
    setMessage(error);
    return !error;
  }
  const vacation = (part: Partial<EmailSettings["vacation"]>) =>
    update({ vacation: { ...form.vacation, ...part } });
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
        onSubmit={async (e) => {
          e.preventDefault();
          if (valid() && await onSave(form))
            setMessage("Email Autopilot-instellingen opgeslagen.");
        }}
      >
        <section className="panel ig-settings-card">
          <div className="ig-card-head">
            <div>
              <h2>Auto Create</h2>
              <p>Een relevant bericht. Op het juiste moment.</p>
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
                mode: "auto",
              })
            }
          />
          <Toggle
            label="Vraag per item toestemming"
            description="Aan: elke e-mail komt eerst in de goedkeuringswachtrij. Uit: Mavix verstuurt direct binnen je regels."
            checked={form.requireApproval}
            onChange={(requireApproval) => update({ requireApproval })}
          />
          {!form.requireApproval && (
            <p className="channel-publication-status">
              Automatisch verzenden:{" "}
              <strong>{form.enabled ? "AAN" : "UIT"}</strong>{" "}
              <small>(simulatie · na opslaan)</small>
            </p>
          )}
          <p className="field-note">
            {form.requireApproval
              ? "Mavix maakt automatisch e-mails volgens jouw schema. Jij keurt goed voordat iets wordt verzonden."
              : "Mavix bedenkt, maakt, plant en verstuurt zelfstandig binnen jouw ingestelde regels."}
          </p>
          {!form.requireApproval && (
            <Toggle
              label="Notificatie na verzending"
              description="Opgeslagen voorkeur; in dit prototype worden geen notificaties verstuurd."
              checked={form.notify ?? true}
              onChange={(notify) => update({ notify })}
            />
          )}
          <p className="field-note">
            Alleen een lokale simulatie. Er draait geen achtergrondtaak en er
            worden geen e-mails verstuurd.
          </p>
        </section>
        <section className="panel ig-settings-card">
          <div className="ig-card-head">
            <h2>
              <CalendarClock size={18} />
              Verzendfrequentie
            </h2>
          </div>
          <label>
            Nieuwsbrieffrequentie
            <select
              aria-label="Nieuwsbrieffrequentie"
              value={form.newsletterPeriod || "week"}
              onChange={(e) =>
                update({ newsletterPeriod: e.target.value as "week" | "month" })
              }
            >
              <option value="week">Per week</option>
              <option value="month">Per maand</option>
            </select>
          </label>
          <div className="ig-frequency">
            {(
              [
                [
                  "newsletters",
                  form.newsletterPeriod === "month"
                    ? "Nieuwsbrieven per maand"
                    : "Nieuwsbrieven per week",
                ],
                ["promotions", "Promoties per maand"],
                ["reengagement", "Re-engagement per maand"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  required
                  min={0}
                  max={12}
                  value={form[key]}
                  onChange={(e) => update({ [key]: Number(e.target.value) })}
                />
              </label>
            ))}
          </div>
          <Toggle
            label="Follow-ups automatisch"
            description="Volgt de ingestelde Follow-up-workflow. Alleen via een expliciete triggersimulatie."
            checked={form.followups}
            onChange={(followups) => update({ followups })}
          />
          <fieldset className="ig-days">
            <legend>Verzenddagen</legend>
            {["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"].map((day, i) => (
              <label key={day}>
                <input
                  type="checkbox"
                  checked={form.days.includes(i)}
                  onChange={(e) =>
                    update({
                      days: e.target.checked
                        ? [...form.days, i].sort()
                        : form.days.filter((d) => d !== i),
                    })
                  }
                />
                {day}
              </label>
            ))}
          </fieldset>
          <label>
            Verzendtijd
            <input
              type="time"
              required
              disabled={form.bestTime}
              value={form.time}
              onChange={(e) => update({ time: e.target.value })}
            />
          </label>
          <Toggle
            label="Laat Mavix beste verzendtijd kiezen"
            description="De mockplanner gebruikt 10:00. Extra campagnes krijgen een eigen tijdslot."
            checked={form.bestTime}
            onChange={(bestTime) => update({ bestTime })}
          />
        </section>
        <SettingsGroup
          title="Email content mix"
          description="Verdeel de onderwerpen van je campagnes."
        >
          <section className="panel ig-settings-card">
            <div className="ig-card-head">
              <h2>Email content mix</h2>
              <strong className="ig-total">
                {Object.values(form.mix).reduce((a, b) => a + b, 0)}%
              </strong>
            </div>
            <div className="ig-mix-bar" aria-hidden="true">
              {Object.keys(emailMix).map((k, i) => (
                <span
                  key={k}
                  style={{ width: form.mix[k] + "%", opacity: 1 - i * 0.15 }}
                />
              ))}
            </div>
            {Object.entries(emailMix).map(([key, label]) => (
              <label className="ig-slider" key={key}>
                <span>
                  {label}
                  <strong>{form.mix[key]}%</strong>
                </span>
                <input
                  aria-label={label}
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
              eerdere campagnes om herhaling te voorkomen. De demo verdeelt
              onderwerpen; inhoudelijke optimalisatie volgt later.
            </p>
          </section>
        </SettingsGroup>
        <SettingsGroup
          title="Doelgroepen"
          description="Kies segmenten of laat Mavix kiezen."
        >
          <section className="panel ig-settings-card">
            <div className="ig-card-head">
              <h2>Doelgroep</h2>
              <Link className="text-link" href="/contacten">
                Contacten
              </Link>
            </div>
            <Toggle
              label="Laat Mavix doelgroep bepalen"
              description="De demo koppelt nieuws aan nieuwsbriefabonnees, promoties aan VIP klanten en re-engagement aan inactieve klanten."
              checked={form.autoAudience}
              onChange={(autoAudience) => update({ autoAudience })}
            />
            <div className="email-segments">
              {segments.map((s) => (
                <label key={s}>
                  <input
                    type="radio"
                    name="email-segment"
                    value={s}
                    disabled={form.autoAudience}
                    checked={form.audience === s}
                    onChange={() => update({ audience: s })}
                  />
                  <span>
                    {s}
                    <small>{recipients(s).length} ingeschreven contacten</small>
                  </span>
                </label>
              ))}
            </div>
            <p className="field-note">
              Dit zijn de voorbeeldcontacten uit Contacten. Uitgeschreven en
              onbevestigde contacten zijn uitgesloten. Een leeg segment
              blokkeert de planning.
            </p>
          </section>
        </SettingsGroup>
        <SettingsGroup
          title="Regels & veiligheid"
          description="Bronnen, toestemming en handelen bij twijfel."
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
                {Object.entries(emailAllowed).map(([key, label]) => (
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
                {Object.entries(emailForbidden).map(([key, label]) => (
                  <Toggle
                    key={key}
                    label={label}
                    checked={form.forbidden[key]}
                    disabled={["unknown", "customers", "unsubscribed"].includes(
                      key,
                    )}
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
              Onbekende feiten en klantgegevens worden nooit verzonnen.
              Uitgeschreven contacten blijven altijd uitgesloten. De
              mockgenerator voegt geen eigen prijzen, kortingen of claims toe.
            </p>
          </section>
        </SettingsGroup>
        <SettingsGroup
          title="Automatische workflows"
          description="Welcome, follow-up, re-engagement en promoties."
        >
          <section className="panel ig-settings-card">
            <div className="ig-card-head">
              <h2>
                <Workflow size={18} />
                Automatische e-mailtypes
              </h2>
            </div>
            <p className="field-note">
              Triggers zijn voorbeelden en worden niet bewaakt. Test ze
              afzonderlijk met de triggersimulatie.
            </p>
            <div className="email-workflows">
              {form.workflows.map((w, i) => {
                const change = (part: Partial<typeof w>) =>
                  update({
                    workflows: form.workflows.map((v, j) =>
                      i === j ? { ...v, ...part } : v,
                    ),
                  });
                return (
                  <div className="email-workflow" key={w.name}>
                    <Toggle
                      label={w.name}
                      checked={w.enabled}
                      onChange={(enabled) => change({ enabled })}
                    />
                    <div className="ig-two-fields">
                      <label>
                        {w.name}: doelgroep
                        <select
                          value={w.audience}
                          onChange={(e) => change({ audience: e.target.value })}
                        >
                          {segments.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {w.name}: trigger
                        <input
                          required
                          maxLength={160}
                          value={w.trigger}
                          onChange={(e) => change({ trigger: e.target.value })}
                        />
                      </label>
                    </div>
                    <Toggle
                      label={w.name + ": goedkeuring vereist"}
                      checked={w.approval}
                      onChange={(approval) => change({ approval })}
                    />
                  </div>
                );
              })}
            </div>
            <p className="field-note">
              Staat &apos;Vraag per item toestemming&apos; aan, dan vraagt
              Mavix altijd goedkeuring, ook als die bij een workflow uitstaat.
              Staat de toggle uit, dan volgt Mavix de workflowregel per type.
            </p>
          </section>
        </SettingsGroup>
        <SettingsGroup
          title="Vakantiemodus"
          description="Tijdelijk een ander ritme; daarna je vorige instellingen."
        >
          <section className="panel ig-settings-card ig-away">
            <div className="ig-card-head">
              <h2>
                <Plane size={18} />
                Autopilot while I&apos;m away
              </h2>
            </div>
            <Toggle
              label="Vakantiemodus activeren"
              checked={form.vacation.enabled}
              onChange={(enabled) => vacation({ enabled })}
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
                      onChange={(e) => vacation({ from: e.target.value })}
                    />
                  </label>
                  <label>
                    Until
                    <input
                      type="date"
                      required
                      min={form.vacation.from}
                      value={form.vacation.until}
                      onChange={(e) => vacation({ until: e.target.value })}
                    />
                  </label>
                </div>
                <label>
                  Campagnes per week
                  <input
                    type="number"
                    min={0}
                    max={12}
                    required
                    value={form.vacation.campaigns}
                    onChange={(e) =>
                      vacation({ campaigns: Number(e.target.value) })
                    }
                  />
                </label>
                <Toggle
                  label="Automatisch verzenden"
                  checked={form.vacation.automatic}
                  onChange={(automatic) =>
                    vacation({ automatic, approval: !automatic })
                  }
                />
                <Toggle
                  label="Goedkeuring vereist"
                  checked={form.vacation.approval}
                  onChange={(approval) =>
                    vacation({ approval, automatic: !approval })
                  }
                />
                <Toggle
                  label="Notificatie na verzending"
                  checked={form.vacation.notify}
                  onChange={(notify) => vacation({ notify })}
                />
                <p className="field-note">
                  Na einddatum: terug naar vorige Autopilot-instelling.{" "}
                  {emailPolicy(form, new Date()).away
                    ? "Vakantieregels gelden nu."
                    : "Vakantieregels gelden alleen binnen de gekozen datums."}{" "}
                  Notificaties worden niet echt verstuurd. Het vakantieritme
                  vervangt het normale campagneritme.
                </p>
              </>
            )}
          </section>
        </SettingsGroup>
        <div className="ig-settings-footer">
          <p role="status">{message}</p>
          <button disabled={busy} className="button primary">
            <Save size={16} />
            Instellingen opslaan
          </button>
        </div>
      </form>
      <aside>
        <EmailReadiness profile={profile} campaigns={campaigns} />
        <section className="panel ig-simulate">
          <h2>Probeer je Email Autopilot</h2>
          <p>
            Simuleer vier weken. Maandfrequenties gelden één keer binnen deze
            periode. Met &apos;Vraag per item toestemming&apos; aan maakt
            Mavix concepten voor je goedkeuring; staat de toggle uit, dan plant
            Mavix campagnes direct als brongegevens en doelgroep beschikbaar
            zijn.
          </p>
          <button
            className="button primary full"
            disabled={busy || !form.enabled || form.mode === "assist"}
            onClick={() => {
              if (valid()) void onRun(form, false);
            }}
          >
            <Play size={16} />
            {busy ? "Simulatie maken…" : "Simuleer komende 4 weken"}
          </button>
          <button
            className="button secondary full email-trigger-button"
            disabled={busy || !form.enabled || form.mode === "assist"}
            onClick={() => {
              if (valid()) void onRun(form, true);
            }}
          >
            Simuleer workflowtriggers
          </button>
          <small>
            Iedere klik maakt een nieuwe lokale voorbeeldbatch. Workflows voegen
            in deze test één item per actieve trigger toe, los van het
            weekritme.
          </small>
        </section>
      </aside>
    </div>
  );
}
