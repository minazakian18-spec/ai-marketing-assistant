"use client";
import Link from "next/link";
import { Share2, Mail, Target, Megaphone, ArrowRight } from "lucide-react";
import { PageHeading } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import {
  localDashboardItems,
  emailDashboardItems,
  shortDate,
} from "@/lib/dashboard-data";

const options = [
  {
    href: "/social?tab=assist",
    title: "Social post",
    text: "Een Instagram-post met caption en beeld.",
    Icon: Share2,
  },
  {
    href: "/email?tab=assist",
    title: "E-mail",
    text: "Een nieuwsbrief, promotie of follow-up.",
    Icon: Mail,
  },
  {
    href: "/email?tab=assist",
    title: "Campagne",
    text: "Een e-mailcampagne rond één doel of actie.",
    Icon: Target,
  },
];

export default function StudioPage() {
  const { data, ready } = useWorkspace();
  if (!ready) return <p role="status">Content Studio laden…</p>;
  const drafts = [
    ...localDashboardItems(data.posts),
    ...emailDashboardItems(data.email?.campaigns || []),
  ]
    .filter((i) => i.status === "review")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  return (
    <div className="studio">
      <PageHeading
        eyebrow="Werkruimte"
        title="Content Studio"
        description="Wat wil je maken? Mavix gebruikt je Brand Hub als basis."
      />
      <div className="studio-options">
        {options.map(({ href, title, text, Icon }) => (
          <Link key={title} href={href} className="studio-option">
            <span className="studio-option-icon">
              <Icon size={20} />
            </span>
            <strong>{title}</strong>
            <span>{text}</span>
            <ArrowRight size={16} className="studio-option-arrow" />
          </Link>
        ))}
        <Link href="/ads" className="studio-option is-soon">
          <span className="studio-option-icon">
            <Megaphone size={20} />
          </span>
          <strong>Advertentie</strong>
          <span>Vereist een Google Ads-koppeling. Binnenkort beschikbaar.</span>
        </Link>
      </div>

      <section className="panel studio-drafts">
        <div className="dash-block-head">
          <h2>Concepten</h2>
          <Link className="text-link" href="/calendar">
            Alles in de kalender
          </Link>
        </div>
        {drafts.length ? (
          <ul>
            {drafts.map((d) => (
              <li key={d.id}>
                <Link href={d.href}>
                  <strong>{d.title || "Naamloos concept"}</strong>
                  <small>
                    {d.kind} · {shortDate(d.date)}
                  </small>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dash-empty">
            Nog geen concepten. Kies hierboven wat je wilt maken.
          </p>
        )}
      </section>
    </div>
  );
}
