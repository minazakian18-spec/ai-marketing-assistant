"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CheckCheck,
  CalendarDays,
  Eye,
  Orbit,
  Instagram,
  Mail,
  Plug,
} from "lucide-react";
import { PageHeading } from "@/components/ui";
import { ResearchSection } from "@/components/research/research-section";
import "../../research.css";
import { Mavi } from "@/components/mavi";
import { useWorkspace } from "@/components/workspace-provider";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import { NewContentMenu } from "@/components/dashboard/new-content-menu";
import {
  Attention,
  Upcoming,
  RecentContent,
  ItemStatus,
} from "@/components/dashboard/content-sections";
import {
  localDashboardItems,
  emailDashboardItems,
  thisWeek,
  comingWeek,
  shortDate,
  type DashboardItem,
} from "@/lib/dashboard-data";
import "../../dashboard.css";
import {
  defaultInstagram,
  autopilotLabel,
  readiness,
} from "@/lib/instagram-model";

const channelCards = [
  {
    key: "instagram",
    title: "Instagram",
    Icon: Instagram,
    text: "Bereik, engagement en volgersgroei verschijnen hier zodra Instagram gekoppeld is.",
  },
  {
    key: "email",
    title: "E-mail",
    Icon: Mail,
    text: "Open rate en click rate verschijnen hier zodra campagnes via een gekoppeld account verstuurd worden.",
  },
];

export default function Insights() {
  const { data, ready, save } = useWorkspace();
  const [selected, setSelected] = useState<DashboardItem | null>(null);
  const [message, setMessage] = useState("");
  const router = useRouter();
  if (!ready) return <p role="status">Inzichten laden…</p>;
  const now = new Date();
  const local = [
    ...localDashboardItems(data.posts),
    ...emailDashboardItems(data.email?.campaigns || []),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const attention = local.filter((p) =>
    ["review", "blocked", "failed"].includes(p.status),
  );
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
  const planned = local.filter((p) => p.status === "scheduled");
  const upcoming = comingWeek(planned, now);
  const week = thisWeek(local, now);
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
      sub: "In je kalender",
      Icon: CalendarDays,
    },
    {
      label: "Automatisering",
      value: autopilotLabel(data.instagram || defaultInstagram),
      sub: "Social",
      Icon: Orbit,
    },
    {
      label: "Bereik deze maand",
      value: "—",
      sub: "Koppel Instagram om bereik te zien",
      Icon: Eye,
    },
  ];
  return (
    <div className="command-dashboard">
      <PageHeading
        eyebrow="Groei"
        title="Inzichten"
        description="Je planning, openstaande acties en resultaten per kanaal."
        action={<NewContentMenu />}
      />
      <ResearchSection />
      <section className="command-kpis" aria-label="Marketingoverzicht">
        {kpis.map(({ label, value, sub, Icon }) => (
          <article className="command-kpi" key={label}>
            <div>
              <span>{label}</span>
              <Icon size={17} />
            </div>
            <strong key={value} className="metric-value-enter">
              {value}
            </strong>
            <p>{sub}</p>
          </article>
        ))}
      </section>
      <div className="command-priority">
        <Attention items={attention} onView={setSelected} />
        <section className="panel ws-next-step">
          <div className="ws-next-step-head">
            <Mavi size={20} />
            <h2>Volgende stap</h2>
          </div>
          <p>
            {week.some((p) => p.kind.includes("Reel"))
              ? "Je Reel-planning staat klaar. Wissel productcontent af met een kijkje achter de schermen."
              : "Je hebt deze week nog geen Reel gepland. Een korte product-Reel is een goede aanvulling."}
          </p>
          <p>
            {week.some((p) => p.channel === "E-mail")
              ? "Je e-mailplanning staat klaar. Houd je onderwerpregel kort en kies één duidelijke CTA."
              : "Plan ook een nieuwsbrief voor je ingeschreven contacten, met één duidelijke CTA."}
          </p>
          <Link className="button primary" href="/calendar">
            Naar de kalender
            <ArrowUpRight size={16} />
          </Link>
        </section>
      </div>
      <p role="status" className="dashboard-message">
        {message}
      </p>
      <div className="channel-performance">
        {channelCards.map(({ key, title, Icon, text }) => (
          <section className="panel ws-connect" key={key}>
            <span className="ws-connect-icon">
              <Icon size={18} />
            </span>
            <div>
              <h2>{title}</h2>
              <p>{text}</p>
            </div>
            <Link className="button secondary" href="/account/integraties">
              <Plug size={15} />
              Integraties
            </Link>
          </section>
        ))}
      </div>
      <div className="command-bottom">
        <Upcoming items={upcoming} onView={setSelected} />
        <RecentContent items={local} onView={setSelected} />
      </div>
      <ConfirmDialog
        open={selected !== null}
        title={selected?.title || "Content bekijken"}
        onClose={() => setSelected(null)}
        confirmLabel={
          selected?.status === "brand"
            ? "Verbeter Brand Hub"
            : selected?.channel === "E-mail"
              ? "Open E-mail"
              : "Open Social"
        }
        onConfirm={() => {
          if (selected) router.push(selected.href);
          setSelected(null);
        }}
      >
        {selected && (
          <div className="dashboard-detail">
            <p>
              {selected.kind} · {shortDate(selected.date)}
            </p>
            <ItemStatus status={selected.status} />
            <p className="detail-body">{selected.body}</p>
            {selected.channel === "Instagram" &&
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
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
