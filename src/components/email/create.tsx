"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Send, Newspaper, Tag, Reply, HeartHandshake, RefreshCw, Wand2, Monitor, Smartphone, Save, Check, CalendarClock, Copy, Undo2, Eye, PenLine, ChevronDown } from "lucide-react";
import { GmailLogo as Mail } from "@/components/brand-logos";
import { GenerationSkeleton, previewMock } from "@/components/generation-skeleton";
import { GlowBorder } from "@/components/glow-border";
import { Mavi } from "@/components/mavi";
import { Menu } from "@/components/menu";
import { SaveIndicator, type SaveStatus } from "@/components/save-indicator";
import { useWorkspace } from "@/components/workspace-provider";
import { generateEmailCampaign, editContentText, CONTENT_EDIT_LABELS, type ContentEditAction } from "@/lib/api-client";
import { campaignError, type EmailCampaign, type EmailKind } from "@/lib/email-model";
import { segments, recipients } from "@/lib/contact-data";
import { emailLengths, type EmailLength } from "@/lib/ai/email-instruction";
import { formalityOptions, type Formality } from "@/lib/brand-model";
import type { Profile } from "@/lib/types";
import { EmailStatus } from "./shared";
import { SendPanel } from "./send-panel";
import { PlanningNotice } from "@/components/calendar/planning-notice";

// Content Studio for e-mail, the same flow as Instagram: three steps (kind,
// audience, one brief with optional refinements), then the editor next to a
// realistic inbox/letter preview. AI output is always an editable draft;
// nothing is sent from here. Edits autosave after a pause.

const KINDS: { id: EmailKind; label: string; hint: string; Icon: typeof Mail; starter: string }[] = [
  { id: "Create Campaign", label: "Campagne", hint: "Eén boodschap of actie onder de aandacht", Icon: Mail, starter: "Een campagne voor ons bedrijf" },
  { id: "Create Newsletter", label: "Nieuwsbrief", hint: "Je laatste nieuws, tips en updates", Icon: Newspaper, starter: "Een nieuwsbrief met ons laatste nieuws" },
  { id: "Create Promotion", label: "Aanbieding", hint: "Een bestaande korting of deal", Icon: Tag, starter: "Een e-mail over onze bestaande aanbieding" },
  { id: "Create Follow-up", label: "Follow-up", hint: "Bedanken na een bezoek of aankoop", Icon: Reply, starter: "Een vriendelijk vervolg op een aankoop" },
  { id: "Create Welcome Email", label: "Welkom", hint: "Voor nieuwe klanten of inschrijvers", Icon: HeartHandshake, starter: "Een welkomstmail voor nieuwe klanten" },
  { id: "Re-engagement Email", label: "Terugwinnen", hint: "Klanten die je een tijdje niet zag", Icon: RefreshCw, starter: "Een e-mail voor klanten die we een tijdje niet zagen" },
];
const kindLabel = (k: EmailKind) => KINDS.find((x) => x.id === k)?.label || "E-mail";
const AUTOSAVE_MS = 1500;
type Editable = Pick<EmailCampaign, "title" | "subject" | "preview" | "sender" | "audience" | "body" | "cta" | "ctaUrl" | "footer" | "hero" | "date">;
const editable = (c: EmailCampaign): Editable => ({ title: c.title, subject: c.subject, preview: c.preview, sender: c.sender, audience: c.audience, body: c.body, cta: c.cta, ctaUrl: c.ctaUrl, footer: c.footer, hero: c.hero, date: c.date });

export function EmailCreate({
  profile,
  initial,
  initialDate,
  initialAudience,
  fromCalendar = false,
  returnDate,
  initialPreview = false,
  initialBrief = "",
  start,
  onSave,
}: {
  profile: Profile;
  initial?: EmailCampaign;
  initialDate?: string;
  initialAudience?: string;
  fromCalendar?: boolean;
  returnDate?: string;
  initialPreview?: boolean;
  initialBrief?: string;
  start?: "ai" | "manual";
  onSave: (c: EmailCampaign) => Promise<boolean>;
}) {
  const { saveState } = useWorkspace();
  const [prompt, setPrompt] = useState(initial?.prompt || initialBrief);
  const [kind, setKind] = useState<EmailKind>(KINDS.some((k) => k.id === initial?.kind) ? initial!.kind : "Create Campaign");
  const [audience, setAudience] = useState(initial?.audience || initialAudience || "Nieuwsbriefabonnees");
  const [product, setProduct] = useState("");
  const [offer, setOffer] = useState("");
  const [tone, setTone] = useState<Formality | "">("");
  const [length, setLength] = useState<EmailLength>("gemiddeld");
  const [cta, setCta] = useState("");
  const [website, setWebsite] = useState(false);
  // `saved` is the last server-confirmed version; `draft` is what the editor shows.
  const [saved, setSaved] = useState<EmailCampaign | undefined>(initial);
  const [draft, setDraft] = useState<Editable | undefined>(initial ? editable(initial) : undefined);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [view, setView] = useState<"edit" | "preview">(initialPreview && initial ? "preview" : "edit");
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState<"" | "generate" | "edit">("");
  const [status, setStatus] = useState<SaveStatus>(initial ? "saved" : "idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [altMode, setAltMode] = useState<"body" | "subject">("body");
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const products = profile.productList?.length
    ? profile.productList.filter((p) => p.active).map((p) => p.name)
    : (profile.products || "")
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean);
  const offers = (profile.offers || "").split("\n").filter(Boolean);
  const dirty = !!saved && !!draft && JSON.stringify(editable(saved)) !== JSON.stringify(draft);
  const shownStatus: SaveStatus = dirty && status !== "saving" ? "dirty" : status;
  const set = (part: Partial<Editable>) => draft && setDraft({ ...draft, ...part });

  const persist = useCallback(
    async (nextStatus?: EmailCampaign["status"]) => {
      if (!saved || !draft) return false;
      const next: EmailCampaign = {
        ...saved,
        ...draft,
        status: nextStatus || (dirty ? "draft" : saved.status),
        date: nextStatus === "approved" ? "" : draft.date,
        reason: "",
        updatedAt: new Date().toISOString(),
      };
      const problem = nextStatus && nextStatus !== "draft" ? campaignError(next, nextStatus === "scheduled") : "";
      if (problem) {
        setError(problem);
        return false;
      }
      setStatus("saving");
      const ok = await onSave(next);
      setStatus(ok ? "saved" : "error");
      if (ok) {
        setSaved(next);
        setDraft(editable(next));
      }
      return ok;
    },
    [saved, draft, dirty, onSave],
  );

  useEffect(() => {
    if (!dirty || busy) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (saveState !== "saving") void persist();
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer.current);
  }, [dirty, busy, draft, persist, saveState]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function generate() {
    setMessage("");
    setError("");
    if (!prompt.trim()) {
      setError("Beschrijf eerst waar de e-mail over gaat.");
      return;
    }
    setBusy("generate");
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
          variant: saved ? saved.variant + 1 : 0,
          tone: tone || undefined,
          length,
          cta: cta.trim() || undefined,
        }),
      );
      // Regenerate keeps the same concept id (no duplicate drafts).
      if (saved) {
        next.id = saved.id;
        next.createdAt = saved.createdAt;
        if (draft) setHistory((h) => [...h.slice(-9), draft.body]);
      }
      const planned = saved?.date || initialDate || "";
      const withDate = planned ? { ...next, date: planned } : next;
      setStatus("saving");
      if (await onSave(withDate)) {
        setSaved(withDate);
        setDraft(editable(withDate));
        setAlternatives([]);
        setStatus("saved");
        setMessage(fromCalendar && withDate.date ? "Concept gemaakt. Controleer de inhoud en bevestig het verzendmoment." : "Concept gemaakt en opgeslagen.");
        setView("edit");
      } else setStatus("error");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Genereren is niet gelukt. Probeer het opnieuw.");
    } finally {
      setBusy("");
    }
  }

  // Start without AI: an empty campaign concept, saved right away as a draft.
  async function startManual() {
    setError("");
    const now = new Date().toISOString();
    const blank: EmailCampaign = {
      id: crypto.randomUUID(),
      title: prompt.trim().slice(0, 120) || "Nieuwe e-mail",
      kind,
      prompt: prompt.trim(),
      subject: "",
      preview: "",
      sender: profile.name || "Ons team",
      audience,
      body: "",
      cta: "",
      ctaUrl: profile.website || "",
      hero: "",
      footer: [profile.name || "Jouw bedrijfsnaam", profile.address, profile.postalCode, profile.city].filter(Boolean).join(" · "),
      status: "draft",
      date: initialDate || "",
      createdAt: now,
      updatedAt: now,
      source: "manual",
      variant: 0,
      reason: "",
    };
    setStatus("saving");
    if (await onSave(blank)) {
      setSaved(blank);
      setDraft(editable(blank));
      setStatus("saved");
      setMessage("Schrijf je onderwerp en inhoud. Mavix slaat automatisch op.");
      window.setTimeout(() => document.getElementById("em-subject")?.focus(), 50);
    } else setStatus("error");
  }

  const started = useRef(false);
  useEffect(() => {
    if (started.current || initial || !start) return;
    started.current = true;
    // Drop brief/start from the URL so a reload never creates a second concept.
    const url = new URL(window.location.href);
    url.searchParams.delete("brief");
    url.searchParams.delete("start");
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
    if (start === "manual") void startManual();
    else if (prompt.trim()) void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  async function edit(action: ContentEditAction) {
    if (!draft?.body.trim()) return;
    setError("");
    setMessage("");
    setBusy("edit");
    try {
      const results = await editContentText(action, draft.body, "email");
      if (action === "alternatives" || action === "headline") {
        setAltMode(action === "headline" ? "subject" : "body");
        setAlternatives(results);
      }
      else if (results[0]) {
        setHistory((h) => [...h.slice(-9), draft.body]);
        set({ body: results[0] });
        setMessage("Mavix AI heeft je tekst aangepast. Controleer het resultaat.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aanpassen is niet gelukt. Je tekst is niet gewijzigd.");
    } finally {
      setBusy("");
    }
  }
  function undo() {
    const last = history[history.length - 1];
    if (last === undefined) return;
    set({ body: last });
    setHistory((h) => h.slice(0, -1));
  }
  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(`Onderwerp: ${draft.subject}\n\n${draft.body}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Kopiëren is niet gelukt. Selecteer de tekst handmatig.");
    }
  }
  async function finish(next: "approved" | "scheduled") {
    setMessage("");
    setError("");
    if (await persist(next))
      setMessage(next === "scheduled" ? "Ingepland en zichtbaar in de kalender. Versturen gebeurt na jouw bevestiging, of automatisch als je dat bij Automatisering hebt toegestaan." : "Goedgekeurd. Stuur een testmail, verstuur hem of kies een verzendmoment.");
  }

  const count = recipients(draft?.audience || audience).length;
  const generating = busy === "generate";
  const brief = (
    <form
      className={"cs-brief glow-host" + (saved ? " is-compact" : "")}
      onSubmit={(e) => {
        e.preventDefault();
        void generate();
      }}
    >
      <GlowBorder />

      <label htmlFor="em-prompt" className="sr-only">
        Waar gaat de e-mail over?
      </label>
      <textarea
        id="em-prompt"
        rows={saved ? 2 : 3}
        maxLength={1500}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void generate();
          }
        }}
        placeholder="Bijvoorbeeld: onze nieuwe zomerpizza's, met de bestaande actie 2 halen 1 betalen."
      />
      <div className="cs-brief-bar">
        <span />
        {!saved && (
          <button type="button" className="button secondary" disabled={!!busy} onClick={() => void startManual()}>
            <PenLine size={15} />
            Zelf schrijven
          </button>
        )}
        <button className="button primary cs-go" aria-busy={generating} disabled={!!busy || !prompt.trim()}>
          {generating ? <Mavi size={16} state="thinking" tone="brand" live /> : saved ? <RefreshCw size={15} /> : <Wand2 size={15} />}
          {generating ? "Bezig…" : saved ? "Opnieuw genereren" : "Maak mijn e-mail"}
        </button>
      </div>
    </form>
  );
  // Refinements, folded away under "Meer opties" so the start stays simple.
  const moreOptions = (
    <>
      <label className="cs-field">
        <span>Product of dienst</span>
        <select value={product} onChange={(e) => setProduct(e.target.value)}>
          <option value="">Mavix kiest op basis van je opdracht</option>
          {products.map((p, i) => (
            <option key={i}>{p}</option>
          ))}
        </select>
      </label>
      {offers.length > 0 && (
        <label className="cs-field">
          <span>Aanbieding</span>
          <select value={offer} onChange={(e) => setOffer(e.target.value)}>
            <option value="">Geen aanbieding</option>
            {offers.map((p, i) => (
              <option key={i}>{p}</option>
            ))}
          </select>
        </label>
      )}
      <label className="cs-field">
        <span>Toon</span>
        <select value={tone} onChange={(e) => setTone(e.target.value as Formality | "")}>
          <option value="">Merkstem</option>
          {formalityOptions.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>
      <label className="cs-field">
        <span>Lengte</span>
        <select value={length} onChange={(e) => setLength(e.target.value as EmailLength)}>
          {emailLengths.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <label className="cs-field">
        <span>Call-to-action</span>
        <input value={cta} maxLength={120} placeholder={profile.strategy?.ctas?.[0] || "Bijv. Bekijk het menu"} onChange={(e) => setCta(e.target.value)} />
      </label>
      <label className="cs-switch">
        <input type="checkbox" checked={website} disabled={!profile.description} onChange={(e) => setWebsite(e.target.checked)} />
        <span>
          <strong>Bedrijfsomschrijving uit Brand Hub gebruiken</strong>
        </span>
      </label>
    </>
  );

  return (
    <>
      {fromCalendar && <PlanningNotice action="Versturen" dateTime={draft ? draft.date : initialDate || ""} returnDate={returnDate} existing={!!initial} />}
      <div className="cs-studio">
        <div className="cs-toolbar">
          <div className="cs-toolbar-title">
            <h2>{saved ? kindLabel(saved.kind) + "-concept" : "Nieuwe e-mail"}</h2>
            {saved && <EmailStatus status={saved.status} />}
            <SaveIndicator status={shownStatus} />
          </div>
          <div className="cs-view-switch" role="tablist" aria-label="Weergave">
            <button type="button" role="tab" aria-selected={view === "edit"} onClick={() => setView("edit")}>
              <PenLine size={14} aria-hidden="true" /> Bewerken
            </button>
            <button type="button" role="tab" aria-selected={view === "preview"} onClick={() => setView("preview")}>
              <Eye size={14} aria-hidden="true" /> Voorbeeld
            </button>
          </div>
          {saved && (
            <div className="cs-toolbar-actions">
              <button type="button" className="button secondary" onClick={copy}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
                <span>{copied ? "Gekopieerd" : "Kopiëren"}</span>
              </button>
              <button type="button" className="button secondary" onClick={() => void persist()} disabled={status === "saving"}>
                <Save size={15} />
                <span>Opslaan</span>
              </button>
              <button type="button" className="button primary" onClick={() => void finish(draft?.date ? "scheduled" : "approved")} disabled={status === "saving"}>
                {draft?.date ? <CalendarClock size={15} /> : <Check size={15} />}
                <span>{draft?.date ? "Goedkeuren en inplannen" : "Goedkeuren"}</span>
              </button>
            </div>
          )}
        </div>

        {saved && <SendPanel campaign={saved} />}
        {!saved && !generating ? (
          <div className="cs-start">
            <section className="cs-step" aria-labelledby="em-step-1">
              <header>
                <span className="cs-step-n" aria-hidden="true">
                  1
                </span>
                <h3 id="em-step-1">Wat voor e-mail?</h3>
              </header>
              <div className="cs-kinds cs-kinds-3" role="radiogroup" aria-labelledby="em-step-1">
                {KINDS.map(({ id, label, hint, Icon, starter }) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={kind === id}
                    onClick={() => {
                      setKind(id);
                      if (!prompt.trim()) setPrompt(starter);
                    }}
                  >
                    <span className="cs-kind-icon">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <strong>{label}</strong>
                    <small>{hint}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="cs-step" aria-labelledby="em-step-2">
              <header>
                <span className="cs-step-n" aria-hidden="true">
                  2
                </span>
                <h3 id="em-step-2">Voor wie?</h3>
              </header>
              <div className="cs-goals" role="group" aria-labelledby="em-step-2">
                {segments.map((seg) => {
                  const n = recipients(seg).length;
                  const chosen = audience.split(" + ").includes(seg);
                  return (
                    <button
                      key={seg}
                      type="button"
                      aria-pressed={chosen}
                      aria-checked={chosen}
                      onClick={() => {
                        // Several audiences at once; "Alle contacten" stands on its own.
                        const now = audience.split(" + ").filter(Boolean);
                        const next = seg === "Alle contacten" ? ["Alle contacten"] : chosen ? now.filter((x) => x !== seg) : [...now.filter((x) => x !== "Alle contacten"), seg];
                        setAudience(next.length ? next.join(" + ") : "Alle contacten");
                      }}
                    >
                      <strong>{seg}</strong>
                      <small>
                        {n} {n === 1 ? "contact" : "contacten"} met toestemming
                      </small>
                    </button>
                  );
                })}
              </div>
              <div className="em-audience-bar">
                <span>
                  {recipients(audience).length} {recipients(audience).length === 1 ? "ontvanger" : "ontvangers"} met toestemming · je kunt meerdere groepen kiezen
                </span>
                <Link className="button secondary" href="/contacten">
                  Contacten bewerken
                </Link>
              </div>
            </section>

            <section className="cs-step cs-step-brief" aria-labelledby="em-step-3">
              <header>
                <span className="cs-step-n" aria-hidden="true">
                  3
                </span>
                <h3 id="em-step-3">Waar gaat de e-mail over?</h3>
              </header>
              {brief}
              <p className="cs-plan-note">
                <Wand2 size={14} aria-hidden="true" /> Mavix schrijft de onderwerpregel, voorbeeldtekst en inhoud op basis van je Brand Hub. Prijzen en acties verzint Mavix niet.
              </p>
              <details className="cs-more">
                <summary>Meer opties</summary>
                {moreOptions}
              </details>
              {(message || error) && (
                <p role={error ? "alert" : "status"} className={error ? "cs-error" : "cs-message"}>
                  {error || message}
                </p>
              )}
            </section>
          </div>
        ) : (
        <div className="cs-grid cs-grid-ig" data-view={view}>
          <section className="cs-editor" aria-label="Editor">
            {brief}

            {generating && !saved ? (
              <div className="cs-result">
                <GenerationSkeleton email />
              </div>
            ) : saved && draft ? (
              <div className={"cs-result" + (generating ? " is-busy" : "")} aria-busy={generating}>
                <label className="cs-label" htmlFor="em-subject">
                  Onderwerpregel <small>{draft.subject.length} / 80</small>
                </label>
                <input id="em-subject" className="cs-input" maxLength={200} value={draft.subject} onChange={(e) => set({ subject: e.target.value })} />
                <label className="cs-label" htmlFor="em-preview">
                  Voorbeeldtekst <small>Zichtbaar naast het onderwerp in de inbox</small>
                </label>
                <input id="em-preview" className="cs-input" maxLength={200} value={draft.preview} onChange={(e) => set({ preview: e.target.value })} />
                <div className="cs-ai-bar" role="toolbar" aria-label="Tekst aanpassen met Mavix AI">
                  {CONTENT_EDIT_LABELS.slice(0, 3).map(([action, label]) => (
                    <button key={action} type="button" className="cs-chip" disabled={!!busy || !draft.body.trim()} onClick={() => void edit(action)}>
                      {label}
                    </button>
                  ))}
                  <Menu
                    label="Meer AI-acties"
                    align="start"
                    trigger={
                      <span className="cs-chip cs-chip-more">
                        <Wand2 size={13} aria-hidden="true" /> Meer
                      </span>
                    }
                    items={CONTENT_EDIT_LABELS.slice(3).map(([action, label]) => ({ label, disabled: !!busy || !draft.body.trim(), onSelect: () => void edit(action) }))}
                  />
                  {busy === "edit" && (
                    <span className="cs-ai-busy" role="status">
                      <Mavi size={14} state="thinking" tone="brand" live /> Mavix AI past je tekst aan…
                    </span>
                  )}
                  {history.length > 0 && busy !== "edit" && (
                    <button type="button" className="cs-undo" onClick={undo}>
                      <Undo2 size={13} aria-hidden="true" /> Ongedaan maken
                    </button>
                  )}
                </div>
                <label className="cs-label" htmlFor="em-body">
                  Inhoud
                </label>
                <textarea id="em-body" className="cs-caption" rows={14} maxLength={10000} value={draft.body} onChange={(e) => set({ body: e.target.value })} />
                {alternatives.length > 0 && (
                  <div className="cs-alternatives">
                    <p>{altMode === "subject" ? "Kies een nieuwe onderwerpregel:" : "Kies een alternatief om de inhoud te vervangen:"}</p>
                    {alternatives.map((alt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          if (altMode === "subject") set({ subject: alt.split("\n")[0].replace(/^#+\s*/, "").slice(0, 120) });
                          else {
                            setHistory((h) => [...h.slice(-9), draft.body]);
                            set({ body: alt });
                          }
                          setAlternatives([]);
                        }}
                      >
                        {alt}
                      </button>
                    ))}
                    <button type="button" className="cs-undo" onClick={() => setAlternatives([])}>
                      Sluiten
                    </button>
                  </div>
                )}
                <div className="cs-field-row">
                  <div className="cs-field">
                    <label className="cs-label" htmlFor="em-cta">
                      Knoptekst
                    </label>
                    <input id="em-cta" className="cs-input" maxLength={60} value={draft.cta} onChange={(e) => set({ cta: e.target.value })} />
                  </div>
                  <div className="cs-field">
                    <label className="cs-label" htmlFor="em-url">
                      Knoplink
                    </label>
                    <input id="em-url" className="cs-input" type="url" placeholder="https://" value={draft.ctaUrl} onChange={(e) => set({ ctaUrl: e.target.value })} />
                  </div>
                </div>
                <label className="cs-label" htmlFor="em-date">
                  {fromCalendar ? "Verzendmoment" : "Inplannen (optioneel)"}
                </label>
                <input id="em-date" type="datetime-local" value={draft.date} onChange={(e) => set({ date: e.target.value })} />
                <button type="button" className="cs-more" aria-expanded={more} onClick={() => setMore(!more)}>
                  <ChevronDown size={14} aria-hidden="true" /> Afzender, titel en footer
                </button>
                {more && (
                  <div className="cs-more-fields">
                    <div className="cs-field-row">
                      <div className="cs-field">
                        <label className="cs-label" htmlFor="em-sender">
                          Afzendernaam
                        </label>
                        <input id="em-sender" className="cs-input" maxLength={120} value={draft.sender} onChange={(e) => set({ sender: e.target.value })} />
                      </div>
                      <div className="cs-field">
                        <label className="cs-label" htmlFor="em-title">
                          Interne titel
                        </label>
                        <input id="em-title" className="cs-input" maxLength={120} value={draft.title} onChange={(e) => set({ title: e.target.value })} />
                      </div>
                    </div>
                    <label className="cs-label" htmlFor="em-footer">
                      Footer
                    </label>
                    <input id="em-footer" className="cs-input" maxLength={300} value={draft.footer} onChange={(e) => set({ footer: e.target.value })} />
                    <label className="cs-switch">
                      <input type="checkbox" checked={!!draft.hero} disabled={!profile.media?.length} onChange={(e) => set({ hero: e.target.checked ? profile.media?.[0] || "" : "" })} />
                      <span>
                        <strong>Headerafbeelding uit Brand Hub</strong>
                        <small>{profile.media?.length ? "Je eerste merkbeeld bovenaan de e-mail." : "Voeg eerst beelden toe in Brand Hub."}</small>
                      </span>
                    </label>
                  </div>
                )}
              </div>
            ) : (
              <div className="cs-empty">
                <Mavi size={44} tone="brand" live />
                <h3>Begin met een korte opdracht</h3>
                <p>Beschrijf de boodschap en klik op Maak mijn e-mail. Je krijgt een bewerkbaar concept dat automatisch wordt opgeslagen.</p>
              </div>
            )}
            {(message || error) && (
              <p role={error ? "alert" : "status"} className={error ? "cs-error" : "cs-message"}>
                {error || message}
              </p>
            )}
          </section>

          <aside className="cs-preview" aria-label="Voorbeeld">
            <div className="cs-preview-head">
              <p className="cs-preview-label">Voorbeeld in de inbox</p>
              <div className="cs-device" role="group" aria-label="Formaat voorbeeld">
                <button type="button" aria-label="Desktop" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>
                  <Monitor size={14} />
                </button>
                <button type="button" aria-label="Mobiel" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}>
                  <Smartphone size={14} />
                </button>
              </div>
            </div>
            <div className={"em-mail" + (device === "mobile" ? " is-mobile" : "")}>
              <div className="em-envelope">
                <span className="em-from">{draft?.sender || profile.name || "Jouw bedrijf"}</span>
                <strong>{draft?.subject || "Je onderwerpregel"}</strong>
                <span className="em-snippet">{draft?.preview || "De voorbeeldtekst verschijnt hier."}</span>
              </div>
              <article className="em-letter">
                {profile.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="em-logo" src={profile.logo} alt={profile.name || "Logo"} />
                ) : (
                  <div className="em-brand">{draft?.sender || profile.name || "Jouw bedrijf"}</div>
                )}
                {draft?.hero && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="em-hero" src={draft.hero} alt="" />
                )}
                <div className="em-body">{draft?.body || "De inhoud van je e-mail verschijnt hier zodra Mavix AI een concept heeft gemaakt."}</div>
                {draft?.cta && <span className="em-cta">{draft.cta}</span>}
                <footer>
                  {draft?.footer || profile.name}
                  <br />
                  Afmelden · E-mailvoorkeuren
                </footer>
              </article>
            </div>
          </aside>
        </div>
        )}
      </div>
    </>
  );
}
