"use client";
import { useState } from "react";
import {
  GenerationSkeleton,
  previewMock,
} from "@/components/generation-skeleton";
import Link from "next/link";
import {
  Mail,
  Sparkles,
  Newspaper,
  Tag,
  Reply,
  HeartHandshake,
  RefreshCw,
  Type,
  Lightbulb,
  AlignLeft,
  Monitor,
  Smartphone,
} from "lucide-react";
import { generateEmailCampaign } from "@/lib/api-client";
import {
  emailKinds,
  campaignError,
  type EmailCampaign,
  type EmailKind,
} from "@/lib/email-model";
import { segments, recipients } from "@/lib/contact-data";
import { emailLengths, type EmailLength } from "@/lib/ai/email-instruction";
import { formalityOptions, type Formality } from "@/lib/brand-model";
import type { Profile } from "@/lib/types";
import { Toggle } from "@/components/instagram/shared";
import { EmailStatus, EmailPerformance } from "./shared";
const quickIcons = [
  Mail,
  Newspaper,
  Tag,
  Reply,
  HeartHandshake,
  RefreshCw,
  Type,
  AlignLeft,
  Lightbulb,
];
const quickDescriptions = [
  "Eén boodschap, één duidelijke actie",
  "Houd je klanten op de hoogte",
  "Geef een bestaande actie aandacht",
  "Een relevant vervolg op contact",
  "Een warm welkom voor nieuwe klanten",
  "Maak opnieuw contact",
];
export function EmailCreate({
  profile,
  initial,
  initialDate,
  initialAudience,
  onSave,
}: {
  profile: Profile;
  initial?: EmailCampaign;
  initialDate?: string;
  initialAudience?: string;
  onSave: (c: EmailCampaign) => boolean;
}) {
  const [prompt, setPrompt] = useState(initial?.prompt || "");
  const [kind, setKind] = useState<EmailKind>(
    initial?.kind || "Create Campaign",
  );
  const [audience, setAudience] = useState(
    initial?.audience || initialAudience || "Nieuwsbriefabonnees",
  );
  const [product, setProduct] = useState("");
  const [offer, setOffer] = useState("");
  const [tone, setTone] = useState<Formality | "">("");
  const [length, setLength] = useState<EmailLength>("gemiddeld");
  const [cta, setCta] = useState("");
  const [website, setWebsite] = useState(false);
  const [campaign, setCampaign] = useState<EmailCampaign | undefined>(initial);
  const [editing, setEditing] = useState(!!initial);
  const [view, setView] = useState("desktop");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const products = profile.productList?.length
    ? profile.productList.filter((p) => p.active).map((p) => p.name)
    : (profile.products || "")
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean);
  const patch = (part: Partial<EmailCampaign>) => {
    if (campaign)
      setCampaign({ ...campaign, ...part, status: "draft", reason: "" });
    if (part.audience) setAudience(part.audience);
    setMessage("");
  };
  async function generate(regenerate = false) {
    if (!prompt.trim()) return;
    setBusy(true);
    try {
      const next = await previewMock(
        generateEmailCampaign({
          prompt,
          kind,
          profile,
          audience,
          product,
          offer,
          useWebsite: website,
          variant: campaign ? campaign.variant + 1 : 0,
          tone: tone || undefined,
          length,
          cta: cta.trim() || undefined,
        }),
      );
      if (regenerate && campaign) next.id = campaign.id;
      const withDate =
        !regenerate && initialDate ? { ...next, date: initialDate } : next;
      if (onSave(withDate)) {
        setCampaign(withDate);
        setEditing(false);
        setScheduling(false);
        setMessage(
          "Mockconcept gemaakt en lokaal opgeslagen. Controleer de inhoud.",
        );
      }
    } catch {
      setMessage("Genereren is niet gelukt. Probeer opnieuw.");
    } finally {
      setBusy(false);
    }
  }
  function persist(status: EmailCampaign["status"]) {
    if (!campaign) return;
    const next = {
      ...campaign,
      status,
      date:
        status === "scheduled"
          ? campaign.date
          : status === "approved"
            ? ""
            : campaign.date,
      reason: "",
    };
    const error =
      status === "draft" ? "" : campaignError(next, status === "scheduled");
    if (error) {
      setMessage(error);
      return;
    }
    if (onSave(next)) {
      setCampaign(next);
      setEditing(false);
      setScheduling(false);
      setMessage(
        status === "scheduled"
          ? "Campagne lokaal ingepland. Er wordt niets verstuurd."
          : status === "approved"
            ? "Campagne goedgekeurd. Je kunt nu een verzendtijd kiezen."
            : "Wijzigingen opgeslagen als concept.",
      );
    }
  }
  return (
    <div className="ig-create-grid email-create-grid">
      <div>
        <form
          className="panel ig-prompt-card"
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <div className="ig-card-head">
            <h2>
              <Sparkles size={18} />
              Wat wil je dat Mavix maakt?
            </h2>
            <span className="badge draft">Mock AI</span>
          </div>
          <label>
            <span className="sr-only">Je e-mailidee</span>
            <textarea
              required
              maxLength={1500}
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Bijvoorbeeld: Maak een nieuwsbrief over onze nieuwe collectie."
            />
          </label>
          <div className="ig-two-fields">
            <label>
              Doelgroep kiezen
              <select
                aria-label="Doelgroep kiezen"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              >
                {segments.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <small>
                {recipients(audience).length} ingeschreven voorbeeldcontacten
              </small>
            </label>
            <label>
              Product/dienst kiezen
              <select
                aria-label="Product/dienst kiezen"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
              >
                <option value="">Geen product geselecteerd</option>
                {products.map((p, i) => (
                  <option key={i}>{p}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Bestaande aanbieding gebruiken
            <select
              aria-label="Bestaande aanbieding gebruiken"
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
            >
              <option value="">Geen aanbieding geselecteerd</option>
              {(profile.offers || "")
                .split("\n")
                .filter(Boolean)
                .map((p, i) => (
                  <option key={i}>{p}</option>
                ))}
            </select>
          </label>
          <div className="ig-two-fields">
            <label>
              Gewenste toon (optioneel)
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Formality | "")}
              >
                <option value="">Standaard merkstem gebruiken</option>
                {formalityOptions.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Gewenste lengte
              <select
                value={length}
                onChange={(e) => setLength(e.target.value as EmailLength)}
              >
                {emailLengths.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Call-to-action (optioneel)
            <input
              value={cta}
              maxLength={120}
              placeholder="Bijvoorbeeld: Bekijk de collectie"
              onChange={(e) => setCta(e.target.value)}
            />
          </label>
          <Toggle
            label="Website-informatie gebruiken"
            description="Gebruikt je opgeslagen bedrijfsomschrijving; haalt geen website op."
            disabled={!profile.website}
            checked={website}
            onChange={setWebsite}
          />
          <p className="field-note">
            Producten en aanbiedingen komen uit{" "}
            <Link href="/brand-hub">Brand Hub</Link>. Doelgroepen delen de
            mockdata van <Link href="/contacten">Contacten</Link>.
          </p>
          <button
            className="button primary full"
            aria-busy={busy}
            disabled={busy || !prompt.trim()}
          >
            <Sparkles size={16} />
            {busy ? "Concept maken…" : "Genereren"}
          </button>
        </form>
        <div className="ig-section-title">
          <h2>Quick Create</h2>
          <span>Kies je e-mailtype</span>
        </div>
        <div className="ig-quick-grid">
          {emailKinds.slice(0, 6).map((k, i) => {
            const Icon = quickIcons[i];
            return (
              <button
                key={k}
                aria-pressed={kind === k}
                onClick={() => {
                  setKind(k);
                  if (!prompt)
                    setPrompt(
                      [
                        "Maak een campagne voor ons bedrijf",
                        "Maak een nieuwsbrief met ons laatste nieuws",
                        "Maak een e-mail over onze bestaande aanbieding",
                        "Maak een vriendelijk vervolg op een aankoop",
                        "Maak een welkomstmail voor nieuwe klanten",
                        "Maak een e-mail voor klanten die we een tijdje niet zagen",
                      ][i],
                    );
                }}
              >
                <Icon size={21} />
                <strong>{k}</strong>
                <small>{quickDescriptions[i]}</small>
              </button>
            );
          })}
        </div>
        <div className="email-mini-tools">
          {emailKinds.slice(6).map((k, i) => {
            const Icon = quickIcons[i + 6];
            return (
              <button
                key={k}
                aria-pressed={kind === k}
                onClick={() => {
                  setKind(k);
                  if (!prompt) setPrompt("Een nieuwe update voor onze klanten");
                }}
              >
                <Icon size={16} />
                {k}
              </button>
            );
          })}
        </div>
        {emailKinds.indexOf(kind) >= 6 && (
          <section className="panel email-tool">
            <h3>{kind}</h3>
            <p className="field-note">
              Kies een onderwerp in het invoerveld en klik Genereren. Je kunt
              het resultaat verder bewerken.
            </p>
            {campaign &&
              (kind === "Subject Lines" ? (
                <ul>
                  {[
                    "Ontdek: ",
                    "Nieuw voor jou: ",
                    "Even bijpraten over: ",
                  ].map((t) => (
                    <li key={t}>
                      <button
                        onClick={() => {
                          patch({ subject: t + prompt.slice(0, 80) });
                          setEditing(true);
                        }}
                      >
                        {t + prompt.slice(0, 80)}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : kind === "Preview Text" ? (
                <p>{campaign.preview}</p>
              ) : (
                <ul>
                  {[
                    "Een product uit je Brand Hub uitlichten",
                    "Een korte update vanuit je bedrijf",
                    "Een praktische tip voor je doelgroep",
                  ].map((t) => (
                    <li key={t}>
                      <button
                        onClick={() => {
                          setPrompt(t);
                          setKind("Create Campaign");
                        }}
                      >
                        {t}
                      </button>
                    </li>
                  ))}
                </ul>
              ))}
          </section>
        )}
        <EmailPerformance />
      </div>
      <section className="panel email-preview-panel">
        <div className="ig-card-head">
          <h2>E-mail preview</h2>
          <div
            className="email-device"
            role="group"
            aria-label="Previewformaat"
          >
            <button
              aria-label="Desktop preview"
              aria-pressed={view === "desktop"}
              onClick={() => setView("desktop")}
            >
              <Monitor size={17} />
            </button>
            <button
              aria-label="Mobiele preview"
              aria-pressed={view === "mobile"}
              onClick={() => setView("mobile")}
            >
              <Smartphone size={17} />
            </button>
          </div>
        </div>
        {busy ? (
          <GenerationSkeleton email />
        ) : campaign ? (
          <>
            <div className="email-preview-meta">
              <EmailStatus status={campaign.status} />
              <span>
                {campaign.kind.replace("Create ", "")} ·{" "}
                {recipients(campaign.audience).length} ontvangers (mock)
              </span>
            </div>
            {editing ? (
              <div className="email-editor">
                <div className="ig-two-fields">
                  {(
                    [
                      ["title", "Campagnetitel"],
                      ["subject", "Onderwerpregel"],
                      ["preview", "Preview text"],
                      ["sender", "Afzendernaam"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        aria-label={label}
                        maxLength={200}
                        value={campaign[key]}
                        onChange={(e) => patch({ [key]: e.target.value })}
                      />
                    </label>
                  ))}
                </div>
                <label>
                  Doelgroep
                  <select
                    aria-label="Doelgroep"
                    value={campaign.audience}
                    onChange={(e) => patch({ audience: e.target.value })}
                  >
                    {segments.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  E-mail body
                  <textarea
                    aria-label="E-mail body"
                    rows={12}
                    maxLength={10000}
                    value={campaign.body}
                    onChange={(e) => patch({ body: e.target.value })}
                  />
                </label>
                <div className="ig-two-fields">
                  <label>
                    CTA tekst
                    <input
                      value={campaign.cta}
                      onChange={(e) => patch({ cta: e.target.value })}
                    />
                  </label>
                  <label>
                    CTA URL
                    <input
                      type="url"
                      value={campaign.ctaUrl}
                      onChange={(e) => patch({ ctaUrl: e.target.value })}
                    />
                  </label>
                </div>
                <label>
                  Footer
                  <input
                    value={campaign.footer}
                    onChange={(e) => patch({ footer: e.target.value })}
                  />
                </label>
                <Toggle
                  label="Hero uit Brand Hub tonen"
                  disabled={!profile.media?.length}
                  checked={!!campaign.hero}
                  onChange={(v) =>
                    patch({ hero: v ? profile.media?.[0] || "" : "" })
                  }
                />
                <button
                  className="button primary"
                  onClick={() => persist("draft")}
                >
                  Wijzigingen opslaan
                </button>
              </div>
            ) : (
              <div
                className={
                  "email-preview-surface result-enter " +
                  (view === "mobile" ? "mobile" : "")
                }
              >
                <div className="email-envelope">
                  <strong>{campaign.subject}</strong>
                  <p>{campaign.preview}</p>
                  <small>
                    Van: {campaign.sender} · Aan: {campaign.audience}
                  </small>
                </div>
                <article className="email-letter">
                  {profile.logo ? (
                    <img
                      className="email-logo"
                      src={profile.logo}
                      alt={profile.name || "Bedrijfslogo"}
                    />
                  ) : (
                    <div className="email-sender">{campaign.sender}</div>
                  )}
                  {campaign.hero && (
                    <img
                      className="email-hero"
                      src={campaign.hero}
                      alt="Hero uit Brand Hub"
                    />
                  )}
                  <div className="email-body">{campaign.body}</div>
                  <button
                    className="button primary"
                    onClick={() =>
                      setMessage(
                        campaign.ctaUrl
                          ? "CTA-voorbeeld verwijst naar " + campaign.ctaUrl
                          : "Voeg in de editor een CTA URL toe.",
                      )
                    }
                  >
                    {campaign.cta}
                  </button>
                  <footer>
                    {campaign.footer}
                    <br />
                    <button
                      onClick={() =>
                        setMessage(
                          "Afmeldlink is een placeholder; er wordt geen contact gewijzigd.",
                        )
                      }
                    >
                      Afmelden
                    </button>{" "}
                    · E-mailvoorkeuren
                    <br />
                    <small>Voorbeeldmail · er wordt niets verzonden</small>
                  </footer>
                </article>
              </div>
            )}
            <div className="email-editor-actions">
              <button
                className="button secondary"
                onClick={() => setEditing(!editing)}
              >
                {editing ? "Preview bekijken" : "Bewerken"}
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void generate(true)}
              >
                Opnieuw maken
              </button>
              <button
                className="button primary"
                onClick={() => persist("approved")}
              >
                Goedkeuren
              </button>
              <button
                className="button secondary"
                onClick={() => {
                  setScheduling(!scheduling);
                  setMessage(
                    "Inplannen bevestigt ook je goedkeuring van deze inhoud.",
                  );
                }}
              >
                Inplannen
              </button>
            </div>
            {scheduling && (
              <div className="email-plan">
                <label>
                  Verzenddatum en tijd
                  <input
                    aria-label="Verzenddatum en tijd"
                    type="datetime-local"
                    value={campaign.date}
                    onChange={(e) => patch({ date: e.target.value })}
                  />
                </label>
                <button
                  className="button primary"
                  onClick={() => persist("scheduled")}
                >
                  Bevestigen en inplannen
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="ig-empty email-preview-empty">
            <Mail size={36} />
            <h2>Van idee naar inbox</h2>
            <p>
              Maak links een concept. Hier zie je het onderwerp, de inhoud en de
              mobiele weergave van je e-mail.
            </p>
            <span className="badge draft">Jouw merk, jouw boodschap</span>
          </div>
        )}
        <p className="ig-feedback" role="status">
          {message}
        </p>
      </section>
    </div>
  );
}
