"use client";
import { useId, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Instagram,
  Plus,
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  Image as ImageIcon,
  Film,
  Layers,
} from "lucide-react";
import { Artwork } from "@/components/ui";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import { modeName } from "@/lib/workspace-navigation";
import {
  instagramOverviewMetrics as metrics,
  bestInstagramPost as best,
  instagramOverviewSeries,
  type InstagramPeriod,
} from "@/lib/instagram-overview-data";
import type { Post } from "@/lib/types";
import type { InstagramSettings } from "@/lib/instagram-model";
import styles from "./overview.module.css";
const href = (post: Post) =>
  "/instagram-ai?tab=assist&post=" + encodeURIComponent(post.id);
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
function Performance() {
  const [period, setPeriod] = useState<InstagramPeriod>(30);
  const id = useId();
  const chartRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(800);
  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(220, Math.round(entries[0].contentRect.width))),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const data = instagramOverviewSeries(period);
  const max = Math.ceil(Math.max(...data.reach) / 1000) * 1000;
  const path = (values: number[], cap: number) =>
    values
      .map(
        (v, i) =>
          `${i === 0 ? "M" : "L"} ${48 + (i / (values.length - 1)) * (width - 96)} ${154 - (v / cap) * 125}`,
      )
      .join(" ");
  return (
    <section className={"panel " + styles.performance}>
      <div className={styles.head}>
        <div>
          <h2>Instagram performance</h2>
          <p>Laatste {period} dagen · mockdata</p>
        </div>
        <label>
          <span className="sr-only">Periode Instagram performance</span>
          <select
            aria-label="Periode Instagram performance"
            value={period}
            onChange={(e) =>
              setPeriod(Number(e.target.value) as InstagramPeriod)
            }
          >
            {[7, 30, 90].map((p) => (
              <option key={p} value={p}>
                {p} dagen
              </option>
            ))}
          </select>
        </label>
      </div>
      <svg
        className={styles.chart}
        ref={chartRef}
        viewBox={`0 0 ${width} 184`}
        role="img"
        aria-labelledby={id}
      >
        <title id={id}>
          Voorbeeldtrend over {period} dagen. Bereik op de linkeras,
          engagementpercentage op de rechteras. Geen echte analytics.
        </title>
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <line
              x1="48"
              x2={width - 48}
              y1={29 + i * 62.5}
              y2={29 + i * 62.5}
              stroke="#eeebf3"
            />
            <text x="38" y={33 + i * 62.5} textAnchor="end">
              {Math.round(max * (1 - i / 2)).toLocaleString("nl-NL")}
            </text>
            <text x={width - 35} y={33 + i * 62.5}>
              {10 - i * 5}%
            </text>
          </g>
        ))}
        <path
          key={"reach" + period}
          className="motion-chart-line"
          pathLength={1}
          d={path(data.reach, max)}
          fill="none"
          stroke="#8e76c4"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          key={"engagement" + period}
          className="motion-chart-reveal"
          d={path(data.engagement, 10)}
          fill="none"
          stroke="#88aba8"
          strokeWidth="2"
          strokeDasharray="5 4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <text x="48" y="178">
          {period} dagen geleden
        </text>
        <text x={width - 48} y="178" textAnchor="end">
          Vandaag
        </text>
      </svg>
      <div className={styles.chartFooter}>
        <div>
          <span>
            <i />
            Bereik
          </span>
          <span>
            <i className={styles.engagementDot} />
            Engagement (%)
          </span>
        </div>
        <Link href="/inzichten">
          Uitgebreide inzichten <ArrowUpRight size={13} />
        </Link>
      </div>
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
  const router = useRouter();
  const [all, setAll] = useState(false);
  const [showBest, setShowBest] = useState(false);
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const drafts = posts
    .filter((p) => p.status === "draft")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const upcoming = posts
    .filter((p) => p.status === "scheduled" && new Date(p.date) > now)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
  const weekly = posts.filter(
    (p) =>
      p.status === "scheduled" &&
      new Date(p.date) >= start &&
      new Date(p.date) < end,
  ).length;
  const active = settings.enabled && settings.mode !== "assist";
  const bestDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    Math.min(8, now.getDate()),
  ).toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
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
            {active ? "Autopilot actief" : "Autopilot uit"}
          </span>
        </div>
        <Link className="button primary" href="/instagram-ai?tab=assist">
          <Plus size={16} />
          Nieuwe content maken
        </Link>
      </section>
      <div className={styles.kpis + " motion-kpis"}>
        {[
          ["Wacht op goedkeuring", String(drafts.length), ""],
          ["Gepland deze week", String(weekly), ""],
          ["Bereik deze maand", metrics.reach, metrics.reachTrend],
          ["Engagement", metrics.engagement, metrics.engagementTrend],
        ].map(([label, value, trend]) => (
          <section className="panel" key={label}>
            <span>{label}</span>
            <div>
              <strong>{value}</strong>
              {trend && <small>{trend}</small>}
            </div>
            <p>
              {trend
                ? "Mockdata · vs vorige maand"
                : label === "Wacht op goedkeuring"
                  ? "Klaar voor jouw blik"
                  : "Uit je lokale planning"}
            </p>
          </section>
        ))}
      </div>
      <Performance />
      <div className={styles.middle}>
        <section className={"panel " + styles.best}>
          <div className={styles.head}>
            <h2>Beste post deze maand</h2>
            <span className="badge draft">Voorbeeld</span>
          </div>
          <div className={styles.bestBody}>
            <button
              type="button"
              aria-label="Bekijk voorbeeldpost"
              onClick={() => setShowBest(true)}
              className={styles.thumbnail + " motion-thumbnail"}
            >
              <Artwork variant={0} />
              <span className="media-action-overlay">
                <ArrowUpRight size={14} />
                Bekijk post
              </span>
            </button>
            <div>
              <h3>{best.title}</h3>
              <small>{bestDate} · mockpost</small>
              <p>{best.caption}</p>
              <dl>
                {[
                  ["Bereik", best.reach],
                  ["Interacties", best.interactions],
                  ["Engagement", best.engagement],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <button className="text-link" onClick={() => setShowBest(true)}>
                Bekijk post <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </section>
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
                    <strong>{post.prompt}</strong>
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
              <Link className="text-link" href="/instagram-ai?tab=assist">
                Plan je eerste content
              </Link>
            </div>
          )}
          <Link className={styles.bottomLink} href="/contentkalender">
            Open contentkalender <ArrowUpRight size={14} />
          </Link>
        </section>
      </div>
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
                <strong>{post.prompt}</strong>
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
        <Link href="/contentkalender">
          Alle content beheren <ArrowUpRight size={13} />
        </Link>
        <span>Lokale planning en concepten · prestaties zijn mockdata</span>
      </div>
      <ConfirmDialog
        open={showBest}
        onClose={() => setShowBest(false)}
        title={best.title}
        confirmLabel="Bekijk inzichten"
        onConfirm={() => {
          setShowBest(false);
          router.push("/inzichten");
        }}
      >
        <p>{bestDate} · Voorbeeldpost, geen echte Instagram-publicatie.</p>
        <p>{best.caption}</p>
        <p>
          {best.reach} bereik · {best.interactions} interacties ·{" "}
          {best.engagement} engagement (mockdata).
        </p>
      </ConfirmDialog>
    </div>
  );
}
