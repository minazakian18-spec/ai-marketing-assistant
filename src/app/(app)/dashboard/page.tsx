"use client";
import { AgentSurface } from "@/components/agent/agent-surface";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { DashboardTodos } from "@/components/dashboard/todos";
import { UpcomingPlanning, type PlanItem } from "@/components/dashboard/upcoming-planning";
import { useWorkspace } from "@/components/workspace-provider";
import { readiness } from "@/lib/instagram-model";
import { useConnections } from "@/lib/use-connections";
import { emailDashboardItems, localDashboardItems, recentActivity } from "@/lib/dashboard-data";
import { buildTodos } from "@/lib/dashboard-todos";

export default function Dashboard() {
  const { data, ready } = useWorkspace();
  const { status, loaded } = useConnections();
  if (!ready)
    return (
      <div className="dash" aria-busy="true">
        <p className="sr-only" role="status">
          Dashboard laden…
        </p>
        <div className="ui-skeleton dash-skeleton-hero" />
        <div className="dash-skeleton-row">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="ui-skeleton" />
          ))}
        </div>
      </div>
    );

  const now = new Date();
  const week = now.getTime() + 7 * 86400000;
  const campaigns = data.email?.campaigns || [];
  const items = [...localDashboardItems(data.posts), ...emailDashboardItems(campaigns)];
  const upcoming = items.filter((i) => i.status === "scheduled" && new Date(i.date) > now);
  const planned: PlanItem[] = upcoming.map((i) => ({ id: i.id, title: i.title, at: i.date, source: i.channel, href: i.href }));
  const activity = recentActivity(data.posts, campaigns, now);
  const failed = items.filter((i) => i.status === "blocked" || i.status === "failed");
  const review = items.filter((i) => i.status === "review");

  const todos = buildTodos({
    brandScore: readiness(data.profile).score,
    review: { count: review.length, href: review[0]?.href || "/social?tab=assist" },
    failed: { count: failed.length, href: failed[0]?.href || "/calendar" },
    campaigns: campaigns.length,
    plannedThisWeek: upcoming.filter((i) => new Date(i.date).getTime() <= week).length,
    status: loaded ? status : undefined,
  });

  return (
    <div className="dash">
      <AgentSurface name={data.account.firstName?.trim()} />
      <QuickActions />
      <div className="dash-columns">
        <DashboardTodos todos={todos} />
        <div className="dash-stack">
          <UpcomingPlanning content={planned} calendarConnected={status("google_calendar") === "connected"} />
          <RecentActivity items={activity} />
        </div>
      </div>
    </div>
  );
}
