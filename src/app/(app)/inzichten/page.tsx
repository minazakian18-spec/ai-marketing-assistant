"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowUpRight,
  ArrowUp,
  CheckCheck,
  CalendarDays,
  Eye,
  MousePointerClick,
  Instagram,
  Mail,
} from "lucide-react";
import { PageHeading } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import { NewContentMenu } from "@/components/dashboard/new-content-menu";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import {
  Attention,
  Upcoming,
  RecentContent,
  ItemStatus,
} from "@/components/dashboard/content-sections";
import {
  mockDashboard,
  localDashboardItems,
  emailDashboardItems,
  thisWeek,
  comingWeek,
  channels,
  shortDate,
  type DashboardItem,
} from "@/lib/dashboard-data";
import "../../dashboard.css";
import {
  defaultInstagram,
  autopilotLabel,
  readiness,
} from "@/lib/instagram-model";
export default function Dashboard() {
  const { data, ready, save } = useWorkspace();
  const [demo, setDemo] = useState(true);
  const [selected, setSelected] = useState<DashboardItem | null>(null);
  const [message, setMessage] = useState("");
  const router = useRouter();
  if (!ready) return <p role="status">Je dashboard laden…</p>;
  const now = new Date();
  const example = mockDashboard(now);
  const local = [
    ...localDashboardItems(data.posts),
    ...emailDashboardItems(data.email?.campaigns || []),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const attention = demo
    ? example.attention
    : local.filter((p) => ["review", "blocked", "failed"].includes(p.status));
  const brand = readiness(data.profile);
  if (brand.score < 100)
    attention.push({
      id: "brand-readiness",
      title: "Vul je Brand Hub aan",
      channel: "Instagram",
      kind: "Brand Hub",
      status: "brand",
      date: now.toISOString(),
      body:
        "Ontbreekt: " +
        brand.checks
          .filter((c) => !c.done)
          .map((c) => c.label)
          .join(", "),
      href: "/brand-hub",
      variant: 0,
      local: true,
    });
  const planned = demo
    ? example.scheduled
    : local.filter((p) => p.status === "scheduled");
  const upcoming = comingWeek(planned, now);
  const recent = demo
    ? example.recent.filter(
        (i) => i.status === "published" || i.status === "sent",
      )
    : local;
  const kpis = [
    {
      label: "Wacht op goedkeuring",
      value: String(attention.filter((i) => i.status === "review").length),
      sub: "Klaar voor jouw blik",
      Icon: CheckCheck,
    },
    {
      label: "Gepland deze week",
      value: String(thisWeek(planned, now).length),
      sub: "In je contentkalender",
      Icon: CalendarDays,
    },
    {
      label: "Autopilot-status",
      value: autopilotLabel(data.instagram || defaultInstagram),
      sub: "Lokale simulatie",
      Icon: MousePointerClick,
      trend: false,
    },
    {
      label: "Bereik deze maand",
      value: "12.840",
      sub: "+18% vs vorige maand",
      Icon: Eye,
      trend: true,
    },
  ];
  return (
    <div className="command-dashboard">
      <PageHeading
        eyebrow="JOUW MARKETING, IN ÉÉN OVERZICHT"
        title="Inzichten"
        description="Je aandacht, planning en resultaten. Klaar voor een goede marketingdag."
        action={<NewContentMenu />}
      />
      <div className="dashboard-data-bar">
        <span>
          <span className="demo-dot" />
          Prestaties en AI-advies zijn voorbeelddata.
        </span>
        <div className="dash-segment" role="group" aria-label="Contentbron">
          <button
            aria-pressed={demo}
            onClick={() => {
              setDemo(true);
              setSelected(null);
              setMessage("");
            }}
          >
            Voorbeeldcontent
          </button>
          <button
            aria-pressed={!demo}
            onClick={() => {
              setDemo(false);
              setSelected(null);
              setMessage("");
            }}
          >
            Mijn content
          </button>
        </div>
      </div>
      <section className="command-kpis" aria-label="Marketingoverzicht">
        {kpis.map(({ label, value, sub, Icon, trend }) => (
          <article
            className={
              "command-kpi " +
              (label === "Autopilot-status" ? "autopilot-kpi" : "")
            }
            key={label}
          >
            <div>
              <span>{label}</span>
              <Icon size={17} />
            </div>
            <strong key={value} className="metric-value-enter">
              {value}
            </strong>
            <p className={trend ? "positive-trend" : ""}>
              {trend && <ArrowUp size={12} />} {sub}
            </p>
          </article>
        ))}
      </section>
      <div className="command-priority">
        <Attention items={attention} onView={setSelected} />
        <section className="ai-advice">
          <div className="advice-header">
            <span>
              <Sparkles size={19} />
            </span>
            <div>
              <h2>Mavix AI adviseert</h2>
              <small>Een slimme volgende stap</small>
            </div>
            <span className="advice-demo">Voorbeeld</span>
          </div>
          <p>
            {thisWeek(local, now).some((p) => p.kind.includes("Reel"))
              ? "Je Reel-planning staat klaar. Wissel productcontent af met een kijkje achter de schermen."
              : "Je hebt deze week nog geen Reel gepland. Mavix adviseert vrijdag een korte product-Reel."}
          </p>
          <p>
            {thisWeek(local, now).some((p) => p.channel === "E-mail")
              ? "Je e-mailplanning staat klaar. Houd je onderwerpregel kort en kies één duidelijke CTA."
              : "Plan ook een nieuwsbrief voor je ingeschreven contacten. Een korte update met één duidelijke CTA is een goede start."}
          </p>
          <Link className="button primary" href="/contentkalender">
            Content plannen
            <ArrowUpRight size={16} />
          </Link>
          <small className="advice-footnote">
            Later persoonlijk AI-advies op basis van je resultaten.
          </small>
        </section>
      </div>
      <p role="status" className="dashboard-message">
        {message}
      </p>
      <PerformanceChart />
      <div className="channel-performance">
        {Object.entries(channels).map(([key, channel]) => {
          const Icon = key === "instagram" ? Instagram : Mail;
          return (
            <section className="panel channel-performance-card" key={key}>
              <div className="dash-section-head">
                <h2>
                  <span
                    className={
                      "dash-channel-icon " + (key === "email" ? "email" : "")
                    }
                  >
                    <Icon size={18} />
                  </span>
                  {channel.title}
                </h2>
                <span className="subtle-label">Deze maand · mockdata</span>
              </div>
              <dl>
                {channel.metrics.map(([label, value], i) => (
                  <div
                    key={label}
                    className={i === 0 ? "channel-highlight" : ""}
                  >
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <Link className="dash-card-link" href="/inzichten">
                {channel.link}
                <ArrowUpRight size={15} />
              </Link>
            </section>
          );
        })}
      </div>
      <div className="command-bottom">
        <Upcoming items={upcoming} onView={setSelected} />
        <RecentContent items={recent} onView={setSelected} />
      </div>
      <ConfirmDialog
        open={selected !== null}
        title={selected?.title || "Content bekijken"}
        onClose={() => setSelected(null)}
        confirmLabel={
          selected?.status === "brand"
            ? "Verbeter Brand Hub"
            : selected?.channel === "E-mail"
              ? "Open Email AI"
              : "Open Instagram AI"
        }
        onConfirm={() => {
          if (selected) router.push(selected.href);
          setSelected(null);
        }}
      >
        {selected && (
          <div className="dashboard-detail">
            <p>
              {selected.kind} · {shortDate(selected.date)} ·{" "}
              {selected.local ? "Lokale content" : "Voorbeeldcontent"}
            </p>
            <ItemStatus status={selected.status} />
            <p className="detail-body">{selected.body}</p>
            {selected.metric && <p>{selected.metric} · mockdata</p>}
            {selected.local &&
              selected.channel === "Instagram" &&
              selected.status === "review" && (
                <button
                  className="button primary"
                  onClick={async () => {
                    if (
                      await save({
                        ...data,
                        posts: data.posts.map((p) =>
                          p.id === selected.id
                            ? { ...p, status: "approved" }
                            : p,
                        ),
                      })
                    ) {
                      setSelected(null);
                      setMessage(
                        "Je concept is goedgekeurd en klaar om in te plannen.",
                      );
                    }
                  }}
                >
                  <CheckCheck size={16} />
                  Goedkeuren
                </button>
              )}
            {!selected.local && (
              <p className="field-note">
                Dit is een voorbeeld. Open de editor om zelf content te maken.
              </p>
            )}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
