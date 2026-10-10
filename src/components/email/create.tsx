"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mail, Newspaper, Tag, Reply, HeartHandshake, RefreshCw, Wand2, Monitor, Smartphone, Save, Check, CalendarClock, Copy, Undo2, Eye, PenLine, ChevronDown } from "lucide-react";
import { GenerationSkeleton, previewMock } from "@/components/generation-skeleton";
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
import { PlanningNotice } from "@/components/calendar/planning-notice";

// Content Studio for e-mail, same structure as Instagram: controls, editor,
// realistic inbox/letter preview. AI output is always an editable draft;
// nothing is sent from here. Edits autosave after a pause.

const KINDS: { id: EmailKind; label: string; Icon: typeof Mail; starter: string }[] = [
  { id: "Create Campaign", label: "Campagne", Icon: Mail, starter: "Een campagne voor ons bedrijf" },
  { id: "Create Newsletter", label: "Nieuwsbrief", Icon: Newspaper, starter: "Een nieuwsbrief met ons laatste nieuws" },
  { id: "Create Promotion", label: "Aanbieding", Icon: Tag, starter: "Een e-mail over onze bestaande aanbieding" },
  { id: "Create Follow-up", label: "Follow-up", Icon: Reply, starter: "Een vriendelijk vervolg op een aankoop" },
  { id: "Create Welcome Email", label: "Welkom", Icon: HeartHandshake, starter: "Een welkomstmail voor nieuwe klanten" },
  { id: "Re-engagement Email", label: "Terugwinnen", Icon: RefreshCw, starter: "Een e-mail voor klanten die we een tijdje niet zagen" },
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
  onSave,
}: {
  profile: Profile;
  initial?: EmailCampaign;
  initialDate?: string;
  initialAudience?: string;
  fromCalendar?: boolean;
  returnDate?: string;
  initialPreview?: boolean;
  onSave: (c: EmailCampaign) => Promise<boolean>;
}) {
  const { saveState } = useWorkspace();
  const [prompt, setPrompt] = useState(initial?.prompt || "");
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

  async function edit(action: ContentEditAction) {
    if (!draft?.body.trim()) return;
    setError("");
    setMessage("");
    setBusy("edit");
    try {
      const results = await editContentText(action, draft.body, "email");
      if (action === "alternatives") setAlternatives(results);
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
      setMessage(next === "scheduled" ? "Ingepland en zichtbaar in de kalender. Mavix verstuurt nog geen e-mails; dit is je planning." : "Goedgekeurd. Kies een verzendmoment om in te plannen.");
  }

  const count = recipients(draft?.audience || audience).length;
  const generating = busy === "generate";

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

        <div className="cs-grid" data-view={view}>
          <aside className="cs-controls" aria-label="Instellingen">
            <fieldset className="cs-field">
              <legend>Soort e-mail</legend>
              <div className="cs-formats">
                {KINDS.map(({ id, label, Icon, starter }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={kind === id}
                    onClick={() => {
                      setKind(id);
                      if (!prompt.trim()) setPrompt(starter);
                    }}
                  >
                    <Icon size={15} aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="cs-field">
              <span>Doelgroep</span>
              <select
                value={audience}
                onChange={(e) => {
                  setAudience(e.target.value);
                  set({ audience: e.target.value });
                }}
              >
                {segments.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <small>
                {count} ingeschreven {count === 1 ? "contact" : "contacten"} · uit <Link href="/contacten">Contacten</Link>
              </small>
            </label>
            <label className="cs-field">
              <span>Product of dienst</span>
              <select value={product} onChange={(e) => setProduct(e.target.value)}>
                <option value="">Geen specifiek product</option>
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
            <div className="cs-field-row">
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
            </div>
            <label className="cs-field">
              <span>Call-to-action</span>
              <input value={cta} maxLength={120} placeholder={profile.strategy?.ctas?.[0] || "Bijv. Bekijk het menu"} onChange={(e) => setCta(e.target.value)} />
            </label>
            <label className="cs-switch">
              <input type="checkbox" checked={website} disabled={!profile.description} onChange={(e) => setWebsite(e.target.checked)} />
              <span>
                <strong>Bedrijfsomschrijving gebruiken</strong>
                <small>Uit je Brand Hub; er wordt geen website opgehaald.</small>
              </span>
            </label>
          </aside>

          <section className="cs-editor" aria-label="Editor">
            <form
              className="cs-brief"
              onSubmit={(e) => {
                e.preventDefault();
                void generate();
              }}
            >
              <label htmlFor="em-prompt">Waar gaat de e-mail over?</label>
              <textarea
                id="em-prompt"
                rows={saved ? 2 : 4}
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
                <small>Mavix AI gebruikt je Brand Hub en verzint geen prijzen of acties.</small>
                <button className="button primary" aria-busy={generating} disabled={!!busy || !prompt.trim()}>
                  {generating ? <Mavi size={16} state="thinking" tone="brand" live /> : saved ? <RefreshCw size={15} /> : <Wand2 size={15} />}
                  {generating ? "Bezig…" : saved ? "Opnieuw genereren" : "Genereren"}
                </button>
              </div>
            </form>

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
                    <p>Kies een alternatief om de inhoud te vervangen:</p>
                    {alternatives.map((alt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setHistory((h) => [...h.slice(-9), draft.body]);
                          set({ body: alt });
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
                <p>Kies links het soort e-mail en de doelgroep, beschrijf de boodschap en klik op Genereren. Je krijgt een bewerkbaar concept dat automatisch wordt opgeslagen.</p>
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
      </div>
    </>
  );
}
