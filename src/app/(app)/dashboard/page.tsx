"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, Building2, CheckCheck, Plug, Star } from "lucide-react";
import { AgentSurface } from "@/components/agent/agent-surface";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { UpcomingPlanning, type PlanItem } from "@/components/dashboard/upcoming-planning";
import { useWorkspace } from "@/components/workspace-provider";
import { readiness } from "@/lib/instagram-model";
import { useConnections } from "@/lib/use-connections";
import { emailDashboardItems, localDashboardItems, recentActivity } from "@/lib/dashboard-data";

type Attention = { title: string; href: string; icon: ReactNode; tone?: "warn" };

export default function Dashboard() {
  const { data, ready } = useWorkspace();
  const { status } = useConnections();
  if (!ready) return <p role="status">Dashboard laden…</p>;

  const now = new Date();
  const campaigns = data.email?.campaigns || [];
  const items = [...localDashboardItems(data.posts), ...emailDashboardItems(campaigns)];
  const planned: PlanItem[] = items
    .filter((i) => i.status === "scheduled" && new Date(i.date) > now)
    .map((i) => ({ id: i.id, title: i.title, at: i.date, source: i.channel, href: i.href }));
  const activity = recentActivity(data.posts, campaigns, now);

  // Only things that need a decision; the strip disappears when empty.
  const attention: Attention[] = [];
  const failed = items.filter((i) => i.status === "blocked" || i.status === "failed");
  const review = items.filter((i) => i.status === "review");
  if (failed.length)
    attention.push({
      title: `${failed.length} gepland ${failed.length === 1 ? "item heeft" : "items hebben"} aandacht nodig`,
      href: failed[0].href,
      icon: <AlertTriangle size={15} />,
      tone: "warn",
    });
  for (const [provider, label] of [
    ["google_business", "Google Business Profile"],
    ["gmail", "Gmail"],
    ["google_calendar", "Google Calendar"],
    ["instagram", "Instagram"],
  ] as const) {
    const s = status(provider);
    if (s === "reconnect_required" || s === "permission_missing" || s === "error")
      attention.push({ title: `${label} opnieuw koppelen`, href: "/account/integraties", icon: <Plug size={15} />, tone: "warn" });
  }
  if (status("google_business") === "selection_required")
    attention.push({ title: "Kies je bedrijfslocatie", href: "/account/integraties", icon: <Star size={15} /> });
  if (review.length)
    attention.push({
      title: `${review.length} ${review.length === 1 ? "concept wacht" : "concepten wachten"} op goedkeuring`,
      href: review[0].href,
      icon: <CheckCheck size={15} />,
    });
  const brand = readiness(data.profile);
  if (brand.score < 100)
    attention.push({ title: `Brand Hub ${brand.score}% compleet`, href: "/brand-hub", icon: <Building2 size={15} /> });

  const name = data.account.firstName?.trim();

  return (
    <div className="dash">
      <AgentSurface name={name} />

      {attention.length > 0 && (
        <section className="dash-attention" aria-label="Aandacht nodig">
          {attention.slice(0, 4).map((a) => (
            <Link key={a.title} href={a.href} className={"dash-attention-item" + (a.tone ? " is-" + a.tone : "")}>
              {a.icon}
              <span>{a.title}</span>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          ))}
        </section>
      )}

      <QuickActions />

      <div className="dash-columns">
        <RecentActivity items={activity} />
        <UpcomingPlanning content={planned} calendarConnected={status("google_calendar") === "connected"} />
      </div>
    </div>
  );
}
