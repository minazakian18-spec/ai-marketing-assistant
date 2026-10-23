"use client";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Copy, ExternalLink, FileText, History, ImageIcon, Instagram, Loader2, Mail, RefreshCw, Sparkles } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Mavi } from "@/components/mavi";
import { generateCampaignDraft, type CampaignDraft } from "@/lib/api-client";
import { addCampaign, buildCampaignRecords, campaignItems, campaignSummary, withVersion, type CampaignChannel, type ContentVersion } from "@/lib/campaigns";
import type { Post, Workspace } from "@/lib/types";
import type { EmailCampaign } from "@/lib/email-model";
import type { MarketingCopy } from "@/lib/studio";
import "../../../studio.css";

// Multi-channel campaigns in Content Studio: one goal -> coherent drafts for
// Instagram, e-mail and marketing copy, saved as drafts in the modules that
// own them (linked by campaignId). Approving happens here; scheduling and
// sending stay in Social / E-mail, where their checks already live.

const CHANNEL: Record<CampaignChannel, { label: string; icon: typeof Instagram }> = {
  instagram: { label: "Instagram-post", icon: Instagram },
  email: { label: "E-mail", icon: Mail },
  copy: { label: "Marketingtekst", icon: FileText },
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Concept",
  approved: "Goedgekeurd",
  scheduled: "Ingepland",
  published: "Gepubliceerd (gesimuleerd)",
  sent: "Verzonden (gesimuleerd)",
  ready: "Klaar",
  rejected: "Afgewezen",
  blocked: "Geblokkeerd",
  failed: "Mislukt",
};
const fmtDate = (d: string) => (d ? new Date(d).toLocaleString("nl-NL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

function Count({ value, soft, hard }: { value: string; soft?: number; hard?: number }) {
  const n = value.length;
  const over = (hard && n > hard) || (soft && n > soft);
  return <small className={"cp-count" + (over ? " is-over" : "")}>{n}{hard ? ` / ${hard}` : soft ? ` (richtlijn max. ${soft})` : ""} tekens</small>;
}

// ---------------------------------------------------------------- previews

function InstagramPreview({ name, caption, hashtags, brief }: { name: string; caption: string; hashtags: string; brief?: string }) {
  return (
    <div className="cp-ig" aria-label="Voorbeeld Instagram-post">
      <div className="cp-ig-head">
        <span className="cp-ig-avatar" aria-hidden="true">{(name || "M").charAt(0)}</span>
        <strong>{name || "jouwbedrijf"}</strong>
      </div>
      <div className="cp-ig-media">
        <ImageIcon size={22} aria-hidden="true" />
        <p>{brief ? "Fotobriefing: " + brief : "Kies een foto uit je Bibliotheek bij het inplannen."}</p>
      </div>
      <p className="cp-ig-caption">
        <strong>{name || "jouwbedrijf"}</strong> {caption}
        {hashtags && <span className="cp-ig-tags"> {hashtags}</span>}
      </p>
    </div>
  );
}
function EmailPreview({ sender, subject, preview, body, cta }: { sender: string; subject: string; preview: string; body: string; cta: string }) {
  return (
    <div className="cp-mail" aria-label="Voorbeeld e-mail">
      <div className="cp-mail-env">
        <strong>{sender || "Jouw bedrijf"}</strong>
        <span>
          <b>{subject || "Onderwerp"}</b> — {preview}
        </span>
      </div>
      <div className="cp-mail-body">{body}</div>
      {cta && <span className="cp-mail-cta">{cta}</span>}
    </div>
  );
}

// ---------------------------------------------------------------- new campaign

function NewCampaign() {
  const { data, save, ready } = useWorkspace();
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [channels, setChannels] = useState<CampaignChannel[]>(["instagram", "email"]);
  const [draft, setDraft] = useState<CampaignDraft | null>(null);
  const [example, setExample] = useState(false);
  const [busy, setBusy] = useState<"" | "all" | CampaignChannel | "save">("");
  const [error, setError] = useState("");
  const name = data.profile.name || "";

  async function generate(only?: CampaignChannel) {
    if (goal.trim().length < 5) return setError("Beschrijf je doel in minstens een paar woorden.");
    setError("");
    setBusy(only || "all");
    try {
      const r = await generateCampaignDraft(goal.trim(), only ? [only] : channels, name);
      setExample(r.example);
      // Regenerating one item replaces only that item.
      setDraft((d) => (only && d ? { ...d, [only]: r.draft[only], schedule: [...d.schedule.filter((s) => s.channel !== only), ...r.draft.schedule] } : r.draft));
    } catch (e) {
      setError(e instanceof Error ? e.message : "De campagne kon niet worden gemaakt. Probeer het opnieuw.");
    } finally {
      setBusy("");
    }
  }
  async function keep() {
    if (!draft) return;
    setBusy("save");
    setError("");
    const records = buildCampaignRecords({ ...draft, goal: goal.trim() }, { source: "studio", profile: data.profile });
    const ok = await save(addCampaign(data, records) as Workspace, "Campagne opgeslagen als concepten");
    setBusy("");
    if (ok) router.push("/studio/campagne?id=" + records.campaign.id);
    else setError("Opslaan is niet gelukt. Er is niets bewaard; probeer het opnieuw.");
  }
  const set = <K extends "instagram" | "email" | "copy">(k: K, patch: Partial<NonNullable<CampaignDraft[K]>>) => setDraft((d) => (d && d[k] ? { ...d, [k]: { ...d[k]!, ...patch } } : d));

  if (!ready) return <p role="status">Content Studio laden…</p>;
  return (
    <div className="st2 cp">
      <Link href="/studio" className="st2-back">
        <ArrowLeft size={15} /> Content Studio
      </Link>
      <header className="st2-head">
        <div>
          <h1>Campagne maken</h1>
          <p>Eén doel, samenhangende concepten voor meerdere kanalen. Je controleert alles voordat er iets wordt ingepland.</p>
        </div>
      </header>

      <section className="st2-panel cp-brief">
        <label className="cp-label" htmlFor="cp-goal">
          Wat wil je promoten?
        </label>
        <textarea id="cp-goal" rows={3} maxLength={1000} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Bijv. Promoot ons nieuwe weekendmenu bij klanten uit de buurt." />
        <fieldset className="cp-channels">
          <legend>Kanalen</legend>
          {(Object.keys(CHANNEL) as CampaignChannel[]).map((c) => {
            const Icon = CHANNEL[c].icon;
            return (
              <label key={c} className={channels.includes(c) ? "is-on" : ""}>
                <input type="checkbox" checked={channels.includes(c)} onChange={(e) => setChannels((cs) => (e.target.checked ? [...cs, c] : cs.filter((x) => x !== c)))} />
                <Icon size={15} aria-hidden="true" /> {CHANNEL[c].label}
              </label>
            );
          })}
          <span className="cp-soon">Reels en Stories: binnenkort</span>
        </fieldset>
        <div className="cp-actions">
          <button type="button" className="button primary" onClick={() => void generate()} disabled={!!busy || !channels.length}>
            {busy === "all" ? <Loader2 size={15} className="seo-spin" /> : <Sparkles size={15} />} {draft ? "Opnieuw maken" : "Campagne maken"}
          </button>
          <small className="cp-muted">Mavix gebruikt je Brand Hub en verzint geen prijzen, kortingen of openingstijden.</small>
        </div>
        {error && (
          <p className="cp-error" role="alert">
            {error}
          </p>
        )}
      </section>

      {draft && (
        <>
          {example && <p className="cp-note">Testmodus: dit is een voorbeeld zonder AI, met plekken die je zelf invult.</p>}
          {draft.missing_facts.length > 0 && (
            <div className="cp-warn" role="status">
              <AlertTriangle size={16} aria-hidden="true" />
              <div>
                <strong>Vul dit zelf aan</strong>
                <ul>
                  {draft.missing_facts.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <div className="cp-items">
            {draft.instagram && (
              <article className="st2-panel cp-item">
                <ItemHead channel="instagram" busy={busy === "instagram"} onRegenerate={() => void generate("instagram")} suggested={draft.schedule.find((s) => s.channel === "instagram")} />
                <div className="cp-two">
                  <div className="cp-fields">
                    <label>
                      Caption <Count value={draft.instagram.caption} hard={2200} />
                      <textarea rows={8} value={draft.instagram.caption} onChange={(e) => set("instagram", { caption: e.target.value })} />
                    </label>
                    <label>
                      Hashtags <small className="cp-count">{draft.instagram.hashtags.split(/\s+/).filter((h) => h.startsWith("#")).length} hashtags (max. 30)</small>
                      <input value={draft.instagram.hashtags} onChange={(e) => set("instagram", { hashtags: e.target.value })} />
                    </label>
                    <label>
                      Fotobriefing <small className="cp-count">Mavix maakt geen afbeeldingen; dit beschrijft welke foto past.</small>
                      <textarea rows={2} value={draft.instagram.visual_brief} onChange={(e) => set("instagram", { visual_brief: e.target.value })} />
                    </label>
                  </div>
                  <InstagramPreview name={name} caption={draft.instagram.caption} hashtags={draft.instagram.hashtags} brief={draft.instagram.visual_brief} />
                </div>
              </article>
            )}
            {draft.email && (
              <article className="st2-panel cp-item">
                <ItemHead channel="email" busy={busy === "email"} onRegenerate={() => void generate("email")} suggested={draft.schedule.find((s) => s.channel === "email")} />
                <div className="cp-two">
                  <div className="cp-fields">
                    <label>
                      Onderwerp <Count value={draft.email.subject} soft={60} />
                      <input value={draft.email.subject} onChange={(e) => set("email", { subject: e.target.value })} />
                    </label>
                    <label>
                      Voorbeeldtekst <Count value={draft.email.preview} soft={90} />
                      <input value={draft.email.preview} onChange={(e) => set("email", { preview: e.target.value })} />
                    </label>
                    <label>
                      Inhoud
                      <textarea rows={8} value={draft.email.body} onChange={(e) => set("email", { body: e.target.value })} />
                    </label>
                    <label>
                      Knoptekst
                      <input value={draft.email.cta} maxLength={60} onChange={(e) => set("email", { cta: e.target.value })} />
                    </label>
                  </div>
                  <EmailPreview sender={name} subject={draft.email.subject} preview={draft.email.preview} body={draft.email.body} cta={draft.email.cta} />
                </div>
              </article>
            )}
            {draft.copy && (
              <article className="st2-panel cp-item">
                <ItemHead channel="copy" busy={busy === "copy"} onRegenerate={() => void generate("copy")} />
                <div className="cp-fields">
                  <label>
                    Titel
                    <input value={draft.copy.title} onChange={(e) => set("copy", { title: e.target.value })} />
                  </label>
                  <label>
                    Tekst <Count value={draft.copy.body} />
                    <textarea rows={6} value={draft.copy.body} onChange={(e) => set("copy", { body: e.target.value })} />
                  </label>
                </div>
              </article>
            )}
          </div>
          {draft.ctas.length > 0 && (
            <section className="st2-panel">
              <h2 className="st2-section-title">Ideeën voor je call-to-action</h2>
              <ul className="cp-chips">
                {draft.ctas.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </section>
          )}
          <div className="cp-save">
            <button type="button" className="button primary" onClick={() => void keep()} disabled={!!busy}>
              {busy === "save" ? <Loader2 size={15} className="seo-spin" /> : <Check size={15} />} Opslaan als concepten
            </button>
            <small className="cp-muted">Je concepten verschijnen ook bij Social, E-mail en in de kalender. Er wordt niets gepubliceerd of verstuurd.</small>
          </div>
        </>
      )}
    </div>
  );
}

function ItemHead({ channel, busy, onRegenerate, suggested }: { channel: CampaignChannel; busy: boolean; onRegenerate: () => void; suggested?: { day_offset: number; time: string } }) {
  const Icon = CHANNEL[channel].icon;
  return (
    <header className="cp-item-head">
      <span className={"st2-channel-icon is-" + channel}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <div>
        <h2>{CHANNEL[channel].label}</h2>
        {suggested && (
          <small>
            Voorgesteld: {suggested.day_offset === 0 ? "vandaag" : `over ${suggested.day_offset} ${suggested.day_offset === 1 ? "dag" : "dagen"}`} om {suggested.time}
          </small>
        )}
      </div>
      <button type="button" className="button secondary" onClick={onRegenerate} disabled={busy}>
        {busy ? <Loader2 size={14} className="seo-spin" /> : <RefreshCw size={14} />} Opnieuw maken
      </button>
    </header>
  );
}

// ---------------------------------------------------------------- campaign view

type Item =
  | { kind: "instagram"; record: Post }
  | { kind: "email"; record: EmailCampaign }
  | { kind: "copy"; record: MarketingCopy };

function CampaignView({ id }: { id: string }) {
  const { data, save, ready } = useWorkspace();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState<Record<string, string>>({});
  const campaign = (data.campaigns || []).find((c) => c.id === id);
  const items = useMemo<Item[]>(() => {
    if (!campaign) return [];
    const r = campaignItems(data, campaign.id);
    return [...r.posts.map((record) => ({ kind: "instagram" as const, record })), ...r.emails.map((record) => ({ kind: "email" as const, record })), ...r.copies.map((record) => ({ kind: "copy" as const, record }))];
  }, [data, campaign]);
  if (!ready) return <p role="status">Campagne laden…</p>;
  if (!campaign)
    return (
      <div className="st2 cp">
        <Link href="/studio" className="st2-back">
          <ArrowLeft size={15} /> Content Studio
        </Link>
        <p>Deze campagne bestaat niet (meer).</p>
      </div>
    );
  const sum = campaignSummary(data, campaign);

  // Applies a change to one item in the module that owns it, keeping its previous text.
  async function update(item: Item, change: Record<string, unknown>, message: string) {
    setBusy(item.record.id);
    setError("");
    const now = new Date().toISOString();
    let next: Workspace = data;
    if (item.kind === "instagram") {
      const prev = item.record;
      next = { ...data, posts: data.posts.map((p) => (p.id === prev.id ? withVersion(p, { caption: prev.caption, hashtags: prev.hashtags }, { ...change, updatedAt: now } as Partial<Post>) : p)) };
    } else if (item.kind === "email") {
      const prev = item.record;
      next = { ...data, email: { ...data.email!, campaigns: data.email!.campaigns.map((c) => (c.id === prev.id ? withVersion(c, { subject: prev.subject, preview: prev.preview, body: prev.body }, { ...change, updatedAt: now } as Partial<EmailCampaign>) : c)) } };
    } else {
      const prev = item.record;
      next = { ...data, copies: (data.copies || []).map((c) => (c.id === prev.id ? withVersion(c, { title: prev.title, body: prev.body }, { ...change, updatedAt: now } as Partial<MarketingCopy>) : c)) };
    }
    next = { ...next, campaigns: (next.campaigns || []).map((c) => (c.id === campaign!.id ? { ...c, updatedAt: now } : c)) };
    const ok = await save(next, message);
    setBusy("");
    if (!ok) setError("Opslaan is niet gelukt. De vorige versie is bewaard; probeer het opnieuw.");
    return ok;
  }
  async function regenerate(item: Item) {
    setBusy(item.record.id);
    setError("");
    try {
      const { draft } = await generateCampaignDraft(campaign!.goal, [item.kind], data.profile.name || "");
      const change =
        item.kind === "instagram" && draft.instagram
          ? { caption: draft.instagram.caption, hashtags: draft.instagram.hashtags, status: "draft" }
          : item.kind === "email" && draft.email
            ? { subject: draft.email.subject, preview: draft.email.preview, body: draft.email.body, cta: draft.email.cta, status: "draft" }
            : item.kind === "copy" && draft.copy
              ? { title: draft.copy.title, body: draft.copy.body, status: "draft" }
              : null;
      if (!change) throw new Error("Er kwam geen nieuwe tekst terug.");
      await update(item, change, "Nieuwe versie opgeslagen; de vorige staat in de geschiedenis");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opnieuw maken is niet gelukt.");
      setBusy("");
    }
  }
  async function duplicate(item: Item) {
    const now = new Date().toISOString();
    const copyId = crypto.randomUUID();
    let next: Workspace = data;
    if (item.kind === "instagram") next = { ...data, posts: [{ ...item.record, id: copyId, status: "draft", date: "", history: undefined, createdAt: now, updatedAt: now }, ...data.posts] };
    else if (item.kind === "email") next = { ...data, email: { ...data.email!, campaigns: [{ ...item.record, id: copyId, status: "draft", date: "", history: undefined, createdAt: now, updatedAt: now }, ...data.email!.campaigns] } };
    else next = { ...data, copies: [{ ...item.record, id: copyId, status: "draft", history: undefined, createdAt: now, updatedAt: now }, ...(data.copies || [])] };
    setBusy(item.record.id);
    const ok = await save(next, "Kopie opgeslagen als concept");
    setBusy("");
    if (!ok) setError("Dupliceren is niet gelukt.");
  }
  const mainText = (i: Item) => (i.kind === "instagram" ? i.record.caption : i.kind === "email" ? i.record.body : i.record.body);
  const restoreChange = (i: Item, v: ContentVersion) =>
    i.kind === "instagram" ? { caption: v.caption ?? i.record.caption, hashtags: v.hashtags ?? i.record.hashtags } : i.kind === "email" ? { subject: v.subject ?? i.record.subject, preview: v.preview ?? i.record.preview, body: v.body ?? i.record.body } : { title: v.title ?? i.record.title, body: v.body ?? i.record.body };
  const href = (i: Item) => (i.kind === "instagram" ? "/social?tab=assist&post=" + i.record.id : i.kind === "email" ? "/email?tab=assist&campaign=" + i.record.id : "/studio/tekst?id=" + i.record.id);

  return (
    <div className="st2 cp">
      <Link href="/studio" className="st2-back">
        <ArrowLeft size={15} /> Content Studio
      </Link>
      <header className="st2-head">
        <div>
          <h1>{campaign.title}</h1>
          <p>{campaign.goal}</p>
        </div>
      </header>
      <p className="cp-summary">
        {sum.total} {sum.total === 1 ? "onderdeel" : "onderdelen"} · {sum.drafts} concept · {sum.approved} goedgekeurd · {sum.scheduled} ingepland
        {campaign.source === "agent" && " · gemaakt met Mavix Agent"}
      </p>
      {error && (
        <p className="cp-error" role="alert">
          {error}
        </p>
      )}
      {campaign.visualBrief && (
        <section className="st2-panel cp-brief-box">
          <h2 className="st2-section-title">Fotobriefing</h2>
          <p>{campaign.visualBrief}</p>
          <small className="cp-muted">Mavix maakt geen afbeeldingen. Kies of maak een foto die hierbij past en voeg hem toe bij het inplannen.</small>
        </section>
      )}
      <div className="cp-items">
        {items.map((i) => {
          const Icon = CHANNEL[i.kind].icon;
          const status = i.record.status as string;
          const editable = status === "draft" || status === "approved" || status === "ready";
          const versions = i.record.history || [];
          const isEditing = editing === i.record.id;
          return (
            <article key={i.record.id} className="st2-panel cp-item">
              <header className="cp-item-head">
                <span className={"st2-channel-icon is-" + i.kind}>
                  <Icon size={16} aria-hidden="true" />
                </span>
                <div>
                  <h2>{CHANNEL[i.kind].label}</h2>
                  <small>
                    <span className={"st2-status is-" + (status === "sent" ? "published" : status === "ready" ? "approved" : status)}>{STATUS_LABEL[status] || status}</span>
                    {"date" in i.record && i.record.date ? ` · ${status === "scheduled" ? "gepland" : "voorgesteld"}: ${fmtDate(i.record.date)}` : ""}
                  </small>
                </div>
                <Link href={href(i)} className="button secondary">
                  <ExternalLink size={14} /> {i.kind === "copy" ? "Openen" : "Openen en inplannen"}
                </Link>
              </header>
              {i.kind === "instagram" ? (
                <div className="cp-two">
                  {isEditing ? <textarea rows={8} value={text[i.record.id] ?? i.record.caption} onChange={(e) => setText({ ...text, [i.record.id]: e.target.value })} aria-label="Caption" /> : <p className="cp-text">{i.record.caption}</p>}
                  <InstagramPreview name={data.profile.name} caption={text[i.record.id] ?? i.record.caption} hashtags={i.record.hashtags} brief={i.record.visualBrief} />
                </div>
              ) : i.kind === "email" ? (
                <div className="cp-two">
                  {isEditing ? <textarea rows={8} value={text[i.record.id] ?? i.record.body} onChange={(e) => setText({ ...text, [i.record.id]: e.target.value })} aria-label="Inhoud" /> : <p className="cp-text">{i.record.body}</p>}
                  <EmailPreview sender={i.record.sender} subject={i.record.subject} preview={i.record.preview} body={text[i.record.id] ?? i.record.body} cta={i.record.cta} />
                </div>
              ) : isEditing ? (
                <textarea rows={6} value={text[i.record.id] ?? i.record.body} onChange={(e) => setText({ ...text, [i.record.id]: e.target.value })} aria-label="Tekst" />
              ) : (
                <p className="cp-text">
                  <strong>{i.record.title}</strong>
                  <br />
                  {i.record.body}
                </p>
              )}
              <div className="cp-item-actions">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      className="button primary"
                      disabled={busy === i.record.id}
                      onClick={() =>
                        void update(i, i.kind === "instagram" ? { caption: text[i.record.id] ?? mainText(i), status: "draft" } : { body: text[i.record.id] ?? mainText(i), status: "draft" }, "Wijziging opgeslagen").then((ok) => ok && setEditing(null))
                      }
                    >
                      <Check size={14} /> Opslaan
                    </button>
                    <button type="button" className="button secondary" onClick={() => (setEditing(null), setText({ ...text, [i.record.id]: mainText(i) }))}>
                      Annuleren
                    </button>
                  </>
                ) : (
                  <>
                    {editable && (
                      <button type="button" className="button secondary" onClick={() => (setEditing(i.record.id), setText({ ...text, [i.record.id]: mainText(i) }))}>
                        Bewerken
                      </button>
                    )}
                    {editable && (
                      <button type="button" className="button secondary" disabled={busy === i.record.id} onClick={() => void regenerate(i)}>
                        {busy === i.record.id ? <Loader2 size={14} className="seo-spin" /> : <RefreshCw size={14} />} Opnieuw maken
                      </button>
                    )}
                    {(status === "draft" || (i.kind === "copy" && status === "draft")) && (
                      <button type="button" className="button secondary" disabled={busy === i.record.id} onClick={() => void update(i, { status: i.kind === "copy" ? "ready" : "approved" }, "Goedgekeurd")}>
                        <Check size={14} /> Goedkeuren
                      </button>
                    )}
                    <button type="button" className="button secondary" disabled={busy === i.record.id} onClick={() => void duplicate(i)}>
                      <Copy size={14} /> Dupliceren
                    </button>
                  </>
                )}
              </div>
              {versions.length > 0 && (
                <details className="cp-history">
                  <summary>
                    <History size={14} aria-hidden="true" /> Eerdere versies ({versions.length})
                  </summary>
                  <ol>
                    {versions.map((v, n) => (
                      <li key={v.at + n}>
                        <time>{fmtDate(v.at)}</time>
                        <p>{(v.caption || v.body || v.subject || v.title || "").slice(0, 220)}</p>
                        {editable && (
                          <button type="button" className="seo-link-button" onClick={() => void update(i, { ...restoreChange(i, v), status: "draft" }, "Vorige versie teruggezet")}>
                            Terugzetten
                          </button>
                        )}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </article>
          );
        })}
      </div>
      {!!campaign.ctas?.length && (
        <section className="st2-panel">
          <h2 className="st2-section-title">Ideeën voor je call-to-action</h2>
          <ul className="cp-chips">
            {campaign.ctas.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      )}
      <p className="st2-foot">
        Goedgekeurde en ingeplande onderdelen staan ook in de <Link href="/calendar">kalender</Link>. Inplannen doe je bij Social of E-mail, waar Mavix controleert of alles klaar is.
        Publiceren en versturen zijn in Mavix nog gesimuleerd.
      </p>
    </div>
  );
}

function CampaignPage() {
  const id = useSearchParams().get("id");
  return id ? <CampaignView id={id} /> : <NewCampaign />;
}

export default function Page() {
  return (
    <Suspense fallback={<p role="status">Laden…</p>}>
      <CampaignPage />
    </Suspense>
  );
}

