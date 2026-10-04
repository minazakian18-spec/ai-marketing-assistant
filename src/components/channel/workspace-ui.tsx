import Link from "next/link";
import {
  LayoutDashboard,
  PenLine,
  Layers,
  ArrowUpRight,
  Plus,
  CalendarDays,
  Mail,
  Instagram,
} from "lucide-react";
import type { ReactNode } from "react";
import { modeName, type WorkspaceView } from "@/lib/workspace-navigation";
// In-page sections of a channel workspace. The ?tab= values (overview,
// assist, auto) are kept so existing links and bookmarks keep resolving.
export function WorkspaceNav({
  root,
  view,
  channel,
}: {
  root: string;
  view: WorkspaceView;
  channel: string;
}) {
  const tabs: [WorkspaceView, string][] = [
    ["overview", "Overzicht"],
    ["assist", "Maken"],
    ["auto", "Automatisering"],
  ];
  return (
    <nav className="ws-tabs" aria-label={channel + " onderdelen"}>
      {tabs.map(([key, label]) => (
        <Link
          key={key}
          href={root + "?tab=" + key}
          aria-current={view === key ? "page" : undefined}
          scroll={false}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
export function SettingsGroup({
  title,
  description,
  children,
  open = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="panel channel-settings-group" open={open || undefined}>
      <summary>
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <span className="channel-chevron" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <div>{children}</div>
    </details>
  );
}
export type ChannelItem = {
  id: string;
  title: string;
  kind: string;
  status: string;
  date: string;
  createdAt: string;
  href: string;
};
const dateLabel = (d: string) =>
  d
    ? new Date(d).toLocaleString("nl-NL", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Nog niet gepland";
const statusLabel: Record<string, string> = {
  draft: "Wacht op goedkeuring",
  blocked: "Geblokkeerd",
  failed: "Mislukt",
  approved: "Goedgekeurd",
  scheduled: "Ingepland",
  published: "Demo gepubliceerd",
  sent: "Demo verzonden",
  rejected: "Afgewezen",
};
export function ChannelOverview({
  channel,
  root,
  mode,
  enabled,
  requireApproval,
  items,
  contacts,
}: {
  channel: "Instagram" | "Email";
  root: string;
  mode: string;
  enabled: boolean;
  requireApproval: boolean;
  items: ChannelItem[];
  contacts?: number;
}) {
  const now = new Date(),
    monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const end = new Date(monday);
  end.setDate(end.getDate() + 7);
  const scheduled = items
    .filter((i) => i.status === "scheduled" && new Date(i.date) > now)
    .sort((a, b) => a.date.localeCompare(b.date));
  const weekly = items.filter(
    (i) =>
      i.status === "scheduled" &&
      new Date(i.date) >= monday &&
      new Date(i.date) < end,
  );
  const latest = [...items].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )[0];
  const sent = [...items]
    .filter((i) => ["sent", "published"].includes(i.status))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const email = channel === "Email";
  const Icon = email ? Mail : Instagram;
  const active = enabled && mode !== "assist";
  const autoPublishing = active && !requireApproval;
  return (
    <>
      <section className="panel channel-summary">
        <div>
          <span className="channel-summary-icon">
            <Icon size={22} />
          </span>
          <div>
            <small>Huidige modus</small>
            <h2>{modeName(mode)}</h2>
            <p data-autopilot={autoPublishing ? "active" : undefined}>
              Automatisering {active ? "aan" : "uit"}
            </p>
          </div>
        </div>
        <Link className="button primary" href={root + "?tab=assist"}>
          <Plus size={16} />
          Nieuwe content maken
        </Link>
      </section>
      <div className="channel-kpis">
        {[
          [
            "Wacht op goedkeuring",
            String(items.filter((i) => i.status === "draft").length),
            "Jouw blik maakt het verschil",
          ],
          [
            email ? "Geplande campagnes" : "Gepland deze week",
            String(email ? scheduled.length : weekly.length),
            email ? "Toekomstige verzendingen" : "In je kalender",
          ],
          [
            email ? "Ingeschreven contacten" : "Bereik deze maand",
            email ? String(contacts || 0) : "—",
            email ? "Uit je contacten" : "Koppel Instagram om bereik te zien",
          ],
          [
            email ? "Click rate" : "Engagement",
            "—",
            email
              ? "Beschikbaar zodra campagnes echt verstuurd worden"
              : "Koppel Instagram om engagement te zien",
          ],
        ].map(([label, value, note]) => (
          <article className="panel" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
            <span>{note}</span>
          </article>
        ))}
      </div>
      <div className="channel-recent">
        {[
          [
            email ? "Laatst verzonden campagne" : "Laatst gemaakte content",
            email ? sent : latest,
          ],
          [email ? "Komende campagne" : "Komende geplande post", scheduled[0]],
        ].map(([label, item]) => {
          const c = item as ChannelItem | undefined;
          return (
            <section className="panel" key={String(label)}>
              <h3>
                <CalendarDays size={16} />
                {String(label)}
              </h3>
              {c ? (
                <>
                  <Link href={c.href}>
                    {c.title}
                    <ArrowUpRight size={15} />
                  </Link>
                  <p>
                    {c.kind} · {statusLabel[c.status]} ·{" "}
                    {dateLabel(c.date || c.createdAt)}
                  </p>
                </>
              ) : (
                <>
                  <p>
                    {email && label === "Laatst verzonden campagne"
                      ? "Er zijn nog geen campagnes verzonden."
                      : "Hier verschijnt je content zodra die klaarstaat."}
                  </p>
                  <Link href={root + "?tab=assist"}>
                    Maak een {email ? "e-mail" : "concept"}{" "}
                    <ArrowUpRight size={15} />
                  </Link>
                </>
              )}
            </section>
          );
        })}
      </div>
      <section className="channel-mode-section">
        <div className="ig-section-title">
          <h2>Welke modus gebruik je?</h2>
          <span>Werk op jouw manier</span>
        </div>
        <div className="channel-mode-cards">
          {(
            [
              ["assist", "Maak content wanneer jij dat wilt.", PenLine],
              [
                "auto",
                email
                  ? "Mavix maakt automatisch e-mails. Jij kiest of dat met of zonder jouw goedkeuring gebeurt."
                  : "Mavix maakt automatisch content. Jij kiest of dat met of zonder jouw goedkeuring gebeurt.",
                Layers,
              ],
            ] as const
          ).map(([m, description, Icon]) => (
            <Link key={m} href={root + "?tab=" + m}>
              <Icon size={22} />
              <strong>{modeName(m)}</strong>
              <p>{description}</p>
              <span>
                {mode === m
                  ? "Huidige modus bekijken"
                  : "Ontdek " + modeName(m)}{" "}
                <ArrowUpRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
export function ContentLibrary({ items }: { items: ChannelItem[] }) {
  return (
    <SettingsGroup
      title="Alle content"
      description="Ook goedgekeurde en afgewezen concepten blijven beschikbaar."
    >
      <div className="channel-library">
        {items.length ? (
          [...items]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((i) => (
              <Link key={i.id} href={i.href}>
                <span>
                  <strong>{i.title}</strong>
                  <small>
                    {i.kind} · {statusLabel[i.status]}
                  </small>
                </span>
                <ArrowUpRight size={16} />
              </Link>
            ))
        ) : (
          <p className="field-note">Je hebt nog geen content gemaakt.</p>
        )}
      </div>
    </SettingsGroup>
  );
}
