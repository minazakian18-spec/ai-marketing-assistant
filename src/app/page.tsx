"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  Sparkles,
  Instagram,
  Mail,
  CalendarDays,
  Building2,
  CheckCheck,
  Orbit,
  Megaphone,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { readiness } from "@/lib/instagram-model";
import {
  localDashboardItems,
  emailDashboardItems,
  shortDate,
} from "@/lib/dashboard-data";
import "./home.css";
const actions = [
  {
    label: "Instagram-post maken",
    href: "/instagram-ai?tab=assist",
    Icon: Instagram,
  },
  { label: "E-mail maken", href: "/email-ai?tab=assist", Icon: Mail },
  { label: "Campagne starten", href: "/campagnes", Icon: Megaphone },
  { label: "Content plannen", href: "/contentkalender", Icon: CalendarDays },
  { label: "Autopilot instellen", href: "/instagram-ai?tab=auto", Icon: Orbit },
];
function AiCommandBox() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<{
    label: string;
    href: string;
  } | null>(null);
  return (
    <>
      <form
        className="home-composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!prompt.trim()) return;
          const text = prompt.toLowerCase();
          const action = /autopilot|automatisch/.test(text)
            ? actions[4]
            : /plan|kalender/.test(text)
              ? actions[3]
              : /campagne/.test(text)
                ? actions[2]
                : /mail|nieuwsbrief/.test(text)
                  ? actions[1]
                  : actions[0];
          setResponse(action);
        }}
      >
        <label className="home-composer-label" htmlFor="home-command">
          <Sparkles size={18} /> Jouw marketing begint met een idee
        </label>
        <div>
          <textarea
            id="home-command"
            aria-label="Marketingopdracht"
            placeholder="Vraag Mavix iets of geef een marketingopdracht..."
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setResponse(null);
            }}
            rows={3}
          />
          <button
            type="submit"
            aria-label="Opdracht versturen"
            disabled={!prompt.trim()}
          >
            <ArrowUp size={21} />
          </button>
        </div>
        <small>Lokale assistent · geen echte AI-koppeling</small>
      </form>
      {response && (
        <div className="home-response" role="status">
          <span>
            Voor deze opdracht kun je verder in de onderstaande werkruimte. Er
            is nog niets gegenereerd of gepland.
          </span>
          <Link href={response.href}>
            {response.label}
            <ArrowUpRight size={15} />
          </Link>
        </div>
      )}
    </>
  );
}
function TodayItem({
  icon,
  title,
  detail,
  href,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <li>
      <span className="home-row-icon">{icon}</span>
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
      <Link href={href}>
        Bekijk <ArrowUpRight size={15} />
      </Link>
    </li>
  );
}
export default function Home() {
  const { data, ready } = useWorkspace();
  if (!ready) return <p role="status">Je werkruimte laden…</p>;
  const profile = data.profile;
  const brand = readiness(profile);
  const items = [
    ...localDashboardItems(data.posts),
    ...emailDashboardItems(data.email?.campaigns || []),
  ];
  const reviews = items.filter((i) => i.status === "review");
  const blocked = items.filter(
    (i) => i.status === "blocked" || i.status === "failed",
  );
  const upcoming = items
    .filter((i) => i.status === "scheduled" && new Date(i.date) > new Date())
    .sort((a, b) => a.date.localeCompare(b.date));
  const rows: {
    title: string;
    detail: string;
    href: string;
    icon: ReactNode;
  }[] = [];
  if (reviews.length)
    rows.push({
      title: `${reviews.length} ${reviews.length === 1 ? "concept wacht" : "concepten wachten"} op goedkeuring`,
      detail: "Een laatste blik voordat je content verder kan",
      href: reviews[0].href,
      icon: <CheckCheck size={18} />,
    });
  if (blocked.length)
    rows.push({
      title: `${blocked.length} geplande items hebben aandacht nodig`,
      detail: "Bekijk de geblokkeerde of mislukte content",
      href: blocked[0].href,
      icon: <CalendarDays size={18} />,
    });
  for (const item of upcoming.slice(0, 2))
    rows.push({
      title: item.title,
      detail: item.channel + " · " + shortDate(item.date),
      href: item.href,
      icon:
        item.channel === "E-mail" ? (
          <Mail size={18} />
        ) : (
          <Instagram size={18} />
        ),
    });
  if (brand.score < 100 && rows.length < 4)
    rows.push({
      title: "Maak je Brand Hub compleet",
      detail: "Een sterke basis voor content die bij je bedrijf past",
      href: "/brand-hub",
      icon: <Building2 size={18} />,
    });
  return (
    <div className="mavix-home">
      <section className="home-ai">
        <span className="home-eyebrow">
          <Sparkles size={15} /> JOUW MAVIX WERKRUIMTE
        </span>
        <h1>
          Hallo, {data.account.firstName || "Alex"}!<br />
          <span>Hoe kan Mavix je vandaag helpen?</span>
        </h1>
        <AiCommandBox />
        <div className="home-quick-actions">
          {actions.map(({ label, href, Icon }) => (
            <Link key={href} href={href}>
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </div>
      </section>
      <section aria-labelledby="business-title">
        <div className="home-section-head">
          <h2 id="business-title">Jouw bedrijf</h2>
          <Link href="/brand-hub">
            Brand Hub <ArrowUpRight size={15} />
          </Link>
        </div>
        <article className="home-business">
          <div className="home-business-main">
            <span className="home-business-logo">
              {profile.logo ? (
                <img src={profile.logo} alt="Bedrijfslogo" />
              ) : (
                <Building2 size={28} />
              )}
            </span>
            <div>
              <h3>{profile.name || "Jouw bedrijf"}</h3>
              <p>
                {profile.industry ||
                  "Voeg je bedrijfsgegevens toe in Brand Hub"}
              </p>
              <div className="home-chips">
                <span className="pink">
                  Instagram{" "}
                  {data.integrations.instagram
                    ? "gekoppeld · demo"
                    : "niet gekoppeld"}
                </span>
                <span className="blue">
                  E-mail{" "}
                  {data.integrations.email ? "actief · demo" : "niet gekoppeld"}
                </span>
                <Link href="/brand-hub" className="mint">
                  Brand Hub · {brand.score}% compleet
                </Link>
              </div>
            </div>
          </div>
          <div className="home-business-actions">
            <Link
              className="button secondary"
              href="/instagram-ai?tab=overview"
            >
              <Instagram size={16} />
              Instagram beheren
            </Link>
            <Link className="button secondary" href="/email-ai?tab=overview">
              <Mail size={16} />
              E-mail beheren
            </Link>
          </div>
        </article>
      </section>
      <section className="home-today" aria-labelledby="today-title">
        <div className="home-section-head">
          <h2 id="today-title">Vandaag</h2>
          <Link href="/contentkalender">
            Contentkalender <ArrowUpRight size={15} />
          </Link>
        </div>
        <ul>
          {rows.slice(0, 4).map((row) => (
            <TodayItem key={row.title} {...row} />
          ))}
        </ul>
        {!rows.length && (
          <p className="home-empty">
            Alles is bijgewerkt. Je hebt momenteel geen openstaande acties.
          </p>
        )}
      </section>
    </div>
  );
}
