"use client";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { ArrowRight, CheckCircle2, FileText, Film, Instagram, Mail, Megaphone, Plus, Sparkles, X } from "lucide-react";
import { campaignSummary } from "@/lib/campaigns";
import { useWorkspace } from "@/components/workspace-provider";
import { Mavi } from "@/components/mavi";
import { brandGaps, CHANNELS, studioCounts, studioItems, type StudioChannel, type StudioStatus } from "@/lib/studio";
import "../../studio.css";

// Content Studio overview: what it is for, how to start, and what you were
// working on. It reads the same content records as the calendar and the
// Instagram/e-mail modules; nothing here is a separate copy.

const ICON: Record<StudioChannel, typeof Instagram> = { instagram: Instagram, email: Mail, copy: FileText, reel: Film };
const CHANNEL_LABEL = { instagram: "Instagram", email: "E-mail", copy: "Tekst" } as const;
const NEW_HREF: Record<StudioChannel, string> = {
  instagram: "/studio/nieuw?kanaal=instagram",
  email: "/studio/nieuw?kanaal=email",
  copy: "/studio/nieuw?kanaal=copy",
  reel: "",
};
const FILTERS: { id: "all" | StudioStatus; label: string }[] = [
  { id: "all", label: "Alles" },
  { id: "draft", label: "Concepten" },
  { id: "approved", label: "Goedgekeurd" },
  { id: "scheduled", label: "Ingepland" },
  { id: "published", label: "Gepubliceerd" },
];
const INTRO_KEY = "mavix-studio-intro-dismissed";
// Whether the first-use intro was dismissed (per browser; a convenience only).
const introListeners = new Set<() => void>();
const introDismissed = () => {
  try {
    return localStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return false;
  }
};
function dismissIntro() {
  try {
    localStorage.setItem(INTRO_KEY, "1");
  } catch {
    /* ignore */
  }
  introListeners.forEach((l) => l());
}

function when(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return "Vandaag " + d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  if (days < 2) return "Gisteren";
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

export default function StudioPage() {
  const { data, ready } = useWorkspace();
  const [filter, setFilter] = useState<"all" | StudioStatus>("all");
  const intro = !useSyncExternalStore(
    (l) => (introListeners.add(l), () => introListeners.delete(l)),
    introDismissed,
    () => true,
  );
  const items = useMemo(() => studioItems(data), [data]);
  if (!ready) return <p role="status">Content Studio laden…</p>;
  const counts = studioCounts(items);
  const gaps = brandGaps(data.profile);
  const shown = (filter === "all" ? items : items.filter((i) => i.status === filter)).slice(0, 12);

  return (
    <div className="st2">
      <header className="st2-head">
        <div>
          <h1>Content Studio</h1>
          <p>Maak, bewerk en plan je marketingcontent op één plek.</p>
        </div>
        <div className="st2-head-actions">
          <Link href="/studio/campagne" className="button secondary">
            <Megaphone size={16} />
            Campagne maken
          </Link>
          <Link href="/studio/nieuw" className="button primary">
            <Plus size={16} />
            Nieuwe content maken
          </Link>
        </div>
      </header>

      {intro && (
        <section className="st2-intro" aria-label="Zo werkt Content Studio">
          <Mavi size={28} tone="brand" />
          <div>
            <strong>Beschrijf wat je wilt promoten. Mavix helpt je er een post, e-mail of tekst van te maken.</strong>
            <ol>
              <li>Kies een kanaal</li>
              <li>Beschrijf je idee in één zin</li>
              <li>Pas aan en bekijk het voorbeeld</li>
              <li>Sla op of plan in je kalender</li>
            </ol>
          </div>
          <button
            type="button"
            className="ui-icon-button"
            aria-label="Uitleg verbergen"
            onClick={dismissIntro}
          >
            <X size={15} />
          </button>
        </section>
      )}

      <section aria-labelledby="st2-create">
        <h2 id="st2-create" className="st2-section-title">
          Snel maken
        </h2>
        <ul className="st2-channels">
          {CHANNELS.map((c) => {
            const Icon = ICON[c.id];
            return (
              <li key={c.id}>
                {c.available ? (
                  <Link href={NEW_HREF[c.id]} className="st2-channel">
                    <span className={"st2-channel-icon is-" + c.id}>
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <strong>{c.label}</strong>
                    <span>{c.description}</span>
                    <ArrowRight size={15} className="st2-channel-go" aria-hidden="true" />
                  </Link>
                ) : (
                  <div className="st2-channel is-soon" aria-disabled="true">
                    <span className={"st2-channel-icon is-" + c.id}>
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <strong>
                      {c.label} <small>Binnenkort</small>
                    </strong>
                    <span>{c.note}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {!!data.campaigns?.length && (
        <section className="st2-panel" aria-labelledby="st2-campaigns">
          <div className="st2-panel-head">
            <h2 id="st2-campaigns">Campagnes</h2>
            <Link href="/studio/campagne" className="st2-link">
              Nieuwe campagne <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <ul className="st2-items">
            {data.campaigns.slice(0, 6).map((c) => {
              const s = campaignSummary(data, c);
              return (
                <li key={c.id}>
                  <Link href={"/studio/campagne?id=" + c.id} className="st2-item">
                    <span className="st2-thumb">
                      <Megaphone size={16} aria-hidden="true" />
                    </span>
                    <span className="st2-item-main">
                      <strong>{c.title}</strong>
                      <span>{c.goal}</span>
                    </span>
                    <span className="st2-item-meta">
                      <span className="st2-status is-draft">
                        {s.total} {s.total === 1 ? "onderdeel" : "onderdelen"}
                      </span>
                      <small>
                        {s.approved + s.scheduled} van {s.total} goedgekeurd of ingepland
                      </small>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="st2-grid">
        <section id="mijn-content" className="st2-panel" aria-labelledby="st2-mine">
          <div className="st2-panel-head">
            <h2 id="st2-mine">Verder werken</h2>
            <div className="st2-filters" role="tablist" aria-label="Filter op status">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}>
                  {f.label}
                  {f.id !== "all" && <span className="st2-count">{counts[f.id as keyof typeof counts] ?? 0}</span>}
                </button>
              ))}
            </div>
          </div>
          {!items.length ? (
            <div className="st2-empty">
              <Sparkles size={22} aria-hidden="true" />
              <p>Je hebt nog geen content gemaakt. Begin met een idee of kies hierboven een kanaal.</p>
              <Link href="/studio/nieuw" className="button secondary">
                Nieuwe content maken
              </Link>
            </div>
          ) : !shown.length ? (
            <p className="st2-muted">Niets met deze status.</p>
          ) : (
            <ul className="st2-items">
              {shown.map((i) => {
                const Icon = ICON[i.channel];
                return (
                  <li key={i.channel + i.id}>
                    <Link href={i.href} className="st2-item">
                      <span className="st2-thumb">
                        {i.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={i.image} alt="" />
                        ) : (
                          <Icon size={16} aria-hidden="true" />
                        )}
                      </span>
                      <span className="st2-item-main">
                        <strong>{i.title}</strong>
                        <span>{i.preview || "Nog geen tekst"}</span>
                      </span>
                      <span className="st2-item-meta">
                        <span className={"st2-status is-" + i.status}>{i.statusLabel}</span>
                        <small>
                          {CHANNEL_LABEL[i.channel]} · {i.status === "scheduled" && i.date ? new Date(i.date).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "bewerkt " + when(i.updatedAt).toLowerCase()}
                        </small>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {items.length > 0 && (
            <p className="st2-foot">
              Ingeplande content zie je ook in de <Link href="/calendar">kalender</Link>. Instagram- en e-mailconcepten vind je ook terug bij <Link href="/social?tab=assist">Social</Link> en{" "}
              <Link href="/email?tab=assist">E-mail</Link>.
            </p>
          )}
        </section>

        <aside className="st2-panel st2-brand" aria-labelledby="st2-brand">
          <h2 id="st2-brand">Je merk</h2>
          {gaps.length ? (
            <>
              <p>Mavix schrijft beter als je Brand Hub compleet is. Je kunt wel gewoon beginnen.</p>
              <ul>
                {gaps.map((g) => (
                  <li key={g.label}>
                    <Link href={g.href}>{g.label} toevoegen</Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="st2-ok">
              <CheckCircle2 size={16} aria-hidden="true" /> Je Brand Hub is compleet. Mavix gebruikt je toon, doelgroep en producten.
            </p>
          )}
          <Link href="/brand-hub" className="st2-link">
            Brand Hub openen <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
