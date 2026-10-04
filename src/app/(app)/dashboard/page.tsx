"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Star,
  Instagram,
  Mail,
  CalendarDays,
  Building2,
  CheckCheck,
  AlertTriangle,
  Plug,
  Plus,
} from "lucide-react";
import { Mavi } from "@/components/mavi";
import { useWorkspace } from "@/components/workspace-provider";
import { readiness } from "@/lib/instagram-model";
import { useConnections } from "@/lib/use-connections";
import {
  localDashboardItems,
  emailDashboardItems,
  shortDate,
} from "@/lib/dashboard-data";

function greeting(hour: number) {
  if (hour < 12) return "Goedemorgen";
  if (hour < 18) return "Goedemiddag";
  return "Goedenavond";
}

// A metric tile. Without a connected source it never shows a number, only a
// way to connect it.
function Kpi({
  label,
  icon,
  connected,
  connectLabel,
}: {
  label: string;
  icon: ReactNode;
  connected: boolean;
  connectLabel: string;
}) {
  return (
    <article className="dash-kpi">
      <div className="dash-kpi-head">
        <span>{label}</span>
        {icon}
      </div>
      <strong>—</strong>
      {connected ? (
        <p>Gekoppeld · cijfers nog niet beschikbaar</p>
      ) : (
        <Link href="/account/integraties">
          {connectLabel} <ArrowRight size={13} />
        </Link>
      )}
    </article>
  );
}

function Summary({
  title,
  icon,
  rows,
  connected,
  cta,
  href,
}: {
  title: string;
  icon: ReactNode;
  rows: string[];
  connected: boolean;
  cta: string;
  href: string;
}) {
  return (
    <section className="panel dash-summary">
      <div className="dash-block-head">
        <h2>
          {icon}
          {title}
        </h2>
        <Link className="text-link" href={href}>
          Openen <ArrowUpRight size={14} />
        </Link>
      </div>
      <dl>
        {rows.map((label) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>—</dd>
          </div>
        ))}
      </dl>
      <p className="dash-summary-note">
        {connected ? (
          "Gekoppeld. Statistieken verschijnen hier zodra ze beschikbaar zijn."
        ) : (
          <Link href="/account/integraties">
            <Plug size={14} />
            {cta}
          </Link>
        )}
      </p>
    </section>
  );
}

export default function Dashboard() {
  const { data, ready } = useWorkspace();
  const { status } = useConnections();
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  if (!ready) return <p role="status">Dashboard laden…</p>;

  const now = new Date();
  const brand = readiness(data.profile);
  const items = [
    ...localDashboardItems(data.posts),
    ...emailDashboardItems(data.email?.campaigns || []),
  ];
  const review = items.filter((i) => i.status === "review");
  const failed = items.filter(
    (i) => i.status === "blocked" || i.status === "failed",
  );
  const upcoming = items
    .filter((i) => i.status === "scheduled" && new Date(i.date) > now)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);
  const google = status("google_business");
  const instagram = status("instagram");

  const actions: {
    title: string;
    detail: string;
    href: string;
    icon: ReactNode;
    tone?: "warn";
  }[] = [];
  if (failed.length)
    actions.push({
      title: `${failed.length} gepland ${failed.length === 1 ? "item heeft" : "items hebben"} aandacht nodig`,
      detail: "Geblokkeerd of mislukt",
      href: failed[0].href,
      icon: <AlertTriangle size={16} />,
      tone: "warn",
    });
  for (const [provider, label] of [
    ["google_business", "Google Business Profile"],
    ["gmail", "Gmail"],
    ["google_calendar", "Google Calendar"],
  ] as const) {
    const s = status(provider);
    if (s === "reconnect_required" || s === "permission_missing" || s === "error")
      actions.push({
        title: `${label} opnieuw koppelen`,
        detail: "De koppeling werkt niet meer",
        href: "/account/integraties",
        icon: <Plug size={16} />,
        tone: "warn",
      });
  }
  if (google === "selection_required")
    actions.push({
      title: "Kies je bedrijfslocatie",
      detail: "Google Business Profile is gekoppeld, maar nog zonder locatie",
      href: "/account/integraties",
      icon: <Star size={16} />,
    });
  if (review.length)
    actions.push({
      title: `${review.length} ${review.length === 1 ? "concept wacht" : "concepten wachten"} op goedkeuring`,
      detail: "Bekijk ze voordat ze worden ingepland",
      href: review[0].href,
      icon: <CheckCheck size={16} />,
    });
  if (brand.score < 100)
    actions.push({
      title: "Maak je Brand Hub compleet",
      detail: `${brand.score}% compleet · betere content begint hier`,
      href: "/brand-hub",
      icon: <Building2 size={16} />,
    });

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>
            {greeting(now.getHours())}
            {data.account.firstName ? ", " + data.account.firstName : ""}
          </h1>
          <p className="dash-sub">Dit speelt er vandaag in je marketing.</p>
        </div>
        <Link className="button primary" href="/studio">
          <Plus size={16} />
          Nieuwe content
        </Link>
      </header>

      <form
        className="dash-agent"
        onSubmit={(e) => {
          e.preventDefault();
          const q = prompt.trim();
          router.push(q ? "/agent?q=" + encodeURIComponent(q) : "/agent");
        }}
      >
        <Mavi size={20} />
        <input
          aria-label="Vraag het Mavix Agent"
          placeholder="Vraag het Mavix Agent, bijvoorbeeld: plan content voor volgende week"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button type="submit" className="button secondary">
          Vragen
        </button>
      </form>

      <section className="dash-kpis" aria-label="Kerncijfers">
        <Kpi
          label="Google-beoordeling"
          icon={<Star size={16} />}
          connected={google === "connected"}
          connectLabel="Koppel Google Business Profile"
        />
        <Kpi
          label="Nieuwe reviews"
          icon={<Star size={16} />}
          connected={google === "connected"}
          connectLabel="Koppel Google Business Profile"
        />
        <Kpi
          label="Instagram-bereik"
          icon={<Instagram size={16} />}
          connected={instagram === "connected"}
          connectLabel="Koppel Instagram om bereik te bekijken"
        />
        <Kpi
          label="Engagement"
          icon={<Instagram size={16} />}
          connected={instagram === "connected"}
          connectLabel="Koppel Instagram"
        />
      </section>

      <div className="dash-grid">
        <section className="panel dash-actions">
          <div className="dash-block-head">
            <h2>Aandacht nodig</h2>
            <span className="dash-count">{actions.length}</span>
          </div>
          {actions.length ? (
            <ul>
              {actions.slice(0, 6).map((a) => (
                <li key={a.title} className={a.tone === "warn" ? "warn" : ""}>
                  <span className="dash-action-icon">{a.icon}</span>
                  <div>
                    <strong>{a.title}</strong>
                    <small>{a.detail}</small>
                  </div>
                  <Link href={a.href} aria-label={"Openen: " + a.title}>
                    <ArrowRight size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dash-empty">
              <CheckCheck size={18} />
              Alles is bijgewerkt. Er staat niets open.
            </p>
          )}
        </section>

        <section className="panel dash-upcoming">
          <div className="dash-block-head">
            <h2>Gepland</h2>
            <Link className="text-link" href="/calendar">
              Kalender <ArrowUpRight size={14} />
            </Link>
          </div>
          {upcoming.length ? (
            <ul>
              {upcoming.map((item) => (
                <li key={item.id}>
                  <span className="dash-action-icon">
                    {item.channel === "E-mail" ? (
                      <Mail size={16} />
                    ) : (
                      <Instagram size={16} />
                    )}
                  </span>
                  <Link href={item.href}>
                    <strong>{item.title}</strong>
                    <small>
                      {item.channel} · {shortDate(item.date)}
                    </small>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dash-empty">
              <CalendarDays size={18} />
              Nog niets gepland. <Link href="/studio">Content maken</Link>
            </p>
          )}
        </section>
      </div>

      <div className="dash-grid">
        <Summary
          title="Reviews"
          icon={<Star size={16} />}
          rows={[
            "Gemiddelde score",
            "Nieuwe reviews",
            "Onbeantwoord",
            "Gemiddelde reactietijd",
          ]}
          connected={google === "connected"}
          cta="Koppel Google Business Profile"
          href="/reviews"
        />
        <Summary
          title="Social"
          icon={<Instagram size={16} />}
          rows={["Bereik", "Engagement", "Profielbezoeken", "Volgersgroei"]}
          connected={instagram === "connected"}
          cta="Koppel Instagram"
          href="/social"
        />
      </div>
    </div>
  );
}
