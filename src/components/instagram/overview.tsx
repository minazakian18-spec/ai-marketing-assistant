"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Instagram,
  Plus,
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  Image as ImageIcon,
  Film,
  Layers,
  Plug,
} from "lucide-react";
import { modeName } from "@/lib/workspace-navigation";
import type { Post } from "@/lib/types";
import type { InstagramSettings } from "@/lib/instagram-model";
import { postTitle, scheduleState } from "@/lib/instagram-publish";
import { usePublishCapability } from "./publish";
import styles from "./overview.module.css";
const href = (post: Post) =>
  "/social?tab=assist&post=" + encodeURIComponent(post.id);
const timestamp = (date: string) =>
  new Date(date).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
function ContentIcon({ post }: { post: Post }) {
  const Icon =
    post.contentType?.includes("Reel") || post.contentType === "Animate Image"
      ? Film
      : post.contentType === "Story" || post.contentType === "Carousel"
        ? Layers
        : ImageIcon;
  return (
    <span className={styles.typeIcon}>
      <Icon size={17} />
    </span>
  );
}
// Instagram insights require a connected Instagram account; until then the
// overview shows a connect state instead of sample numbers.
function ConnectInstagram({ title, text }: { title: string; text: string }) {
  return (
    <section className="panel ws-connect">
      <span className="ws-connect-icon">
        <Instagram size={18} />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <Link className="button secondary" href="/account/integraties">
        <Plug size={15} />
        Koppel Instagram
      </Link>
    </section>
  );
}
export function InstagramOverview({
  posts,
  settings,
}: {
  posts: Post[];
  settings: InstagramSettings;
}) {
  const [all, setAll] = useState(false);
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const drafts = posts
    .filter((p) => p.status === "draft")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // One definition of "ingepland" (src/lib/instagram-publish.ts), the same as Content Studio.
  const upcoming = posts
    .filter((p) => scheduleState(p) === "upcoming")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
  const missed = posts.filter((p) => scheduleState(p) === "missed").sort((a, b) => b.date.localeCompare(a.date));
  const weekly = posts.filter(
    (p) =>
      scheduleState(p) === "upcoming" &&
      new Date(p.date) >= start &&
      new Date(p.date) < end,
  ).length;
  // Reach and engagement need Meta's insights permission, not just a connection.
  const cap = usePublishCapability();
  const linked = !!cap && !["not_connected", "not_configured", "demo", "error"].includes(cap.code);
  const insightsNote = linked ? "Instagram is gekoppeld. Voor bereik is extra toestemming van Meta nodig (aanvraag loopt)." : "Koppel Instagram om bereik te zien";
  const engagementNote = linked ? "Instagram is gekoppeld. Voor engagement is extra toestemming van Meta nodig (aanvraag loopt)." : "Koppel Instagram om engagement te zien";
  const active = settings.enabled && settings.mode !== "assist";
  return (
    <div className={styles.overview}>
      <section className={"panel " + styles.mode}>
        <div>
          <span className={styles.modeIcon}>
            <Instagram size={23} />
          </span>
          <div>
            <small>Huidige modus</small>
            <h2>{modeName(settings.mode)}</h2>
          </div>
          <span
            data-autopilot={
              active && !settings.requireApproval ? "active" : undefined
            }
            className={"badge " + (active ? "approved" : "draft")}
          >
            {active ? "Automatisering aan" : "Automatisering uit"}
          </span>
        </div>
        <Link className="button primary" href="/social?tab=assist">
          <Plus size={16} />
          Nieuwe content maken
        </Link>
      </section>
      <div className={styles.kpis + " motion-kpis"}>
        {[
          ["Wacht op goedkeuring", String(drafts.length), "Klaar voor jouw blik"],
          ["Gepland deze week", String(weekly), missed.length ? missed.length + " gemist, zie hieronder" : "Uit je planning"],
          ["Bereik deze maand", "—", insightsNote],
          ["Engagement", "—", engagementNote],
        ].map(([label, value, note]) => (
          <section className="panel" key={label}>
            <span>{label}</span>
            <div>
              <strong>{value}</strong>
            </div>
            <p>{note}</p>
          </section>
        ))}
      </div>
      {!linked && (
        <ConnectInstagram
          title="Instagram-prestaties"
          text="Bereik, engagement en je best presterende posts verschijnen hier zodra Instagram gekoppeld is."
        />
      )}
      {missed.length > 0 && (
        <section className={"panel " + styles.upcoming} aria-labelledby="ig-missed">
          <div className={styles.head}>
            <h2 id="ig-missed">
              Gemist <span className={styles.count}>{missed.length}</span>
            </h2>
            <CalendarDays size={17} />
          </div>
          <p className={styles.missedNote}>Deze posts stonden ingepland, maar zijn niet op Instagram geplaatst. Automatisch publiceren staat uit of de koppeling werkte niet op dat moment.</p>
          <div>
            {missed.map((post) => (
              <div className={styles.row} key={post.id}>
                <ContentIcon post={post} />
                <span className={styles.copy}>
                  <strong>{postTitle(post)}</strong>
                  <small>
                    {post.contentType || "Post"} · gepland {timestamp(post.date)}
                  </small>
                </span>
                <Link className="button primary" href={href(post)}>
                  Nu plaatsen
                </Link>
                <Link className="button secondary" href={href(post) + "&view=preview"}>
                  Opnieuw inplannen
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className={"panel " + styles.upcoming}>
        <div className={styles.head}>
          <h2>Komende content</h2>
          <CalendarDays size={17} />
        </div>
        {upcoming.length ? (
          <div>
            {upcoming.map((post) => (
              <Link className={styles.row} href={href(post)} key={post.id}>
                <ContentIcon post={post} />
                <span className={styles.copy}>
                  <strong>{postTitle(post)}</strong>
                  <small>
                    {post.contentType || "Post"} · {timestamp(post.date)}
                  </small>
                </span>
                <span className="badge scheduled">Ingepland</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <CalendarDays size={22} />
            <p>Je hebt nog niets gepland.</p>
            <Link className="text-link" href="/social?tab=assist">
              Plan je eerste content
            </Link>
          </div>
        )}
        <Link className={styles.bottomLink} href="/calendar">
          Open kalender <ArrowUpRight size={14} />
        </Link>
      </section>
      <section className={"panel " + styles.approvals}>
        <div className={styles.head}>
          <h2>
            Wacht op goedkeuring{" "}
            <span className={styles.count}>{drafts.length}</span>
          </h2>
          {drafts.length > 2 && (
            <button className="text-link" onClick={() => setAll(!all)}>
              {all ? "Toon minder" : "Bekijk alle " + drafts.length}
            </button>
          )}
        </div>
        {drafts.length ? (
          (all ? drafts : drafts.slice(0, 2)).map((post) => (
            <div className={styles.row} key={post.id}>
              <ContentIcon post={post} />
              <span className={styles.copy}>
                <small>Instagram {post.contentType || "Post"}</small>
                <strong>{postTitle(post)}</strong>
              </span>
              <span className={"badge draft " + styles.reviewBadge}>
                Wacht op goedkeuring
              </span>
              <Link className="button secondary" href={href(post)}>
                Open
              </Link>
            </div>
          ))
        ) : (
          <div className={styles.allDone}>
            <CheckCheck size={20} />
            <span>Alles is bijgewerkt.</span>
          </div>
        )}
      </section>
      <div className={styles.archive}>
        <Link href="/calendar">
          Alle content beheren <ArrowUpRight size={13} />
        </Link>
      </div>
    </div>
  );
}
