import type { EmailCampaign } from "./email-model";
import type { Post } from "./types";
export type DashboardItem = {
  id: string;
  title: string;
  channel: "Instagram" | "E-mail";
  kind: string;
  status:
    | "review"
    | "scheduled"
    | "published"
    | "sent"
    | "approved"
    | "blocked"
    | "failed"
    | "rejected"
    | "brand";
  date: string;
  metric?: string;
  body: string;
  href: string;
  variant: number;
  local?: boolean;
};
const dateAt = (base: Date, offset: number, hour = 18) => {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
export function mockDashboard(now: Date): {
  attention: DashboardItem[];
  scheduled: DashboardItem[];
  recent: DashboardItem[];
} {
  const item = (
    id: string,
    title: string,
    channel: DashboardItem["channel"],
    status: DashboardItem["status"],
    date: string,
    kind = channel === "E-mail" ? "E-mailcampagne" : "Instagram-post",
  ): DashboardItem => ({
    id,
    title,
    channel,
    status,
    date,
    kind,
    body:
      channel === "E-mail"
        ? "Een mooie actie voor onze vaste klanten. Ontdek deze maand onze favorieten en laat je inspireren."
        : "Dit weekend zetten we onze favorieten in de spotlight. Kom langs en ontdek jouw nieuwe favoriet! ✨",
    href: channel === "E-mail" ? "/email" : "/social",
    variant: channel === "E-mail" ? 2 : 0,
  });
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const scheduled = Array.from({ length: 10 }, (_, i) =>
    item(
      "plan-" + i,
      [
        "Weekend pasta actie",
        "September klantenactie",
        "Mavix productvideo",
        "Een kijkje achter de schermen",
      ][i % 4],
      i % 3 === 1 ? "E-mail" : "Instagram",
      "scheduled",
      dateAt(monday, i, i % 3 === 1 ? 12 : i % 3 === 2 ? 17 : 18),
      i % 3 === 2
        ? "Instagram Reel"
        : i % 3 === 1
          ? "E-mailcampagne"
          : "Instagram-post",
    ),
  );
  const reel = scheduled.find(
    (entry) => entry.kind === "Instagram Reel" && new Date(entry.date) >= now,
  )!;
  return {
    attention: [
      item(
        "review-1",
        "Weekend pasta actie",
        "Instagram",
        "review",
        dateAt(now, -1),
      ),
      item(
        "review-2",
        "September klantenactie",
        "E-mail",
        "review",
        dateAt(now, -1),
      ),
      reel,
      item(
        "review-3",
        "Onze nieuwe favoriet",
        "Instagram",
        "review",
        dateAt(now, -2),
      ),
    ],
    scheduled,
    recent: [
      {
        ...item(
          "recent-1",
          "Weekendactie",
          "Instagram",
          "published",
          dateAt(now, -2),
        ),
        metric: "4.820 bereik · 318 interacties",
      },
      {
        ...item(
          "recent-2",
          "September nieuwsbrief",
          "E-mail",
          "sent",
          dateAt(now, -3),
        ),
        metric: "184 clicks",
      },
      item(
        "recent-3",
        "Onze nieuwe favoriet",
        "Instagram",
        "review",
        dateAt(now, -1),
      ),
    ],
  };
}
export function localDashboardItems(posts: Post[]): DashboardItem[] {
  return [...posts]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((p) => ({
      id: p.id,
      title: p.prompt,
      channel: "Instagram",
      kind: "Instagram " + (p.contentType || "Post"),
      status: p.status === "draft" ? "review" : p.status,
      date: p.date || p.createdAt,
      body: (p.failureReason ? p.failureReason + "\n\n" : "") + p.caption,
      href: "/social?post=" + encodeURIComponent(p.id),
      variant: p.variant,
      local: true,
    }));
}
export function thisWeek(items: DashboardItem[], now: Date) {
  const start = new Date(now);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return items.filter(
    (i) =>
      i.status === "scheduled" &&
      new Date(i.date) >= start &&
      new Date(i.date) < end,
  );
}
export function comingWeek(items: DashboardItem[], now: Date) {
  const end = new Date(now);
  end.setDate(end.getDate() + 7);
  return items
    .filter(
      (i) =>
        i.status === "scheduled" &&
        new Date(i.date) >= now &&
        new Date(i.date) < end,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}
export const number = (n: number) => new Intl.NumberFormat("nl-NL").format(n);
export const shortDate = (date: string) =>
  new Date(date).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });
export function emailDashboardItems(
  campaigns: EmailCampaign[],
): DashboardItem[] {
  return campaigns.map((c) => ({
    id: c.id,
    title: c.title,
    channel: "E-mail",
    kind: c.kind.replace("Create ", ""),
    status: c.status === "draft" ? "review" : c.status,
    date: c.date || c.createdAt,
    body: (c.reason ? c.reason + "\n\n" : "") + c.subject + "\n\n" + c.body,
    href: "/email?tab=create&campaign=" + encodeURIComponent(c.id),
    variant: 2,
    local: true,
  }));
}

// Recent activity derived from real workspace records (posts and e-mail
// campaigns). Reviews are left out: the review list still contains example
// reviews, which must not show up as real activity.
export type Activity = {
  id: string;
  title: string;
  channel: "Instagram" | "E-mail";
  label: string;
  at: string;
  href: string;
  tone: "neutral" | "accent" | "warn" | "success";
};

const POST_LABELS: Record<Post["status"], [string, Activity["tone"]]> = {
  draft: ["Concept opgeslagen", "neutral"],
  approved: ["Goedgekeurd", "success"],
  scheduled: ["Ingepland", "accent"],
  published: ["Demo gepubliceerd", "success"],
  rejected: ["Afgewezen", "neutral"],
  blocked: ["Geblokkeerd", "warn"],
  failed: ["Mislukt", "warn"],
};
const EMAIL_LABELS: Record<EmailCampaign["status"], [string, Activity["tone"]]> = {
  draft: ["Concept opgeslagen", "neutral"],
  approved: ["Goedgekeurd", "success"],
  scheduled: ["Ingepland", "accent"],
  sent: ["Verzonden (gesimuleerd)", "success"],
  rejected: ["Afgewezen", "neutral"],
  blocked: ["Geblokkeerd", "warn"],
};

export function recentActivity(
  posts: Post[],
  campaigns: EmailCampaign[],
  now: Date,
  limit = 6,
): Activity[] {
  // Published/sent/failed items happened at their planned date; everything
  // else is dated by when it was created.
  const when = (status: string, date: string, createdAt: string) =>
    ["published", "sent", "failed", "blocked"].includes(status) && date ? date : createdAt;
  const items: Activity[] = [
    ...posts.map((p) => {
      const [label, tone] = POST_LABELS[p.status];
      return {
        id: "post-" + p.id,
        title: p.prompt || p.caption.slice(0, 80) || "Instagram-post",
        channel: "Instagram" as const,
        label: p.status === "scheduled" && p.date ? label + " voor " + shortDate(p.date) : label,
        at: when(p.status, p.date, p.createdAt),
        href: "/social?post=" + encodeURIComponent(p.id),
        tone,
      };
    }),
    ...campaigns.map((c) => {
      const [label, tone] = EMAIL_LABELS[c.status];
      return {
        id: "email-" + c.id,
        title: c.title || c.subject || "E-mailcampagne",
        channel: "E-mail" as const,
        label: c.status === "scheduled" && c.date ? label + " voor " + shortDate(c.date) : label,
        at: when(c.status, c.date, c.createdAt),
        href: "/email?tab=create&campaign=" + encodeURIComponent(c.id),
        tone,
      };
    }),
  ];
  return items
    .filter((a) => a.at && !isNaN(Date.parse(a.at)) && new Date(a.at) <= now)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

export const relativeTime = (iso: string, now = new Date()) => {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "zojuist";
  if (minutes < 60) return minutes + " min geleden";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours + " uur geleden";
  const days = Math.round(hours / 24);
  if (days === 1) return "gisteren";
  if (days < 7) return days + " dagen geleden";
  return shortDate(iso);
};
