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
    href: channel === "E-mail" ? "/email-ai" : "/instagram-ai",
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
      href: "/instagram-ai?post=" + encodeURIComponent(p.id),
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
export const channels = {
  instagram: {
    title: "Instagram",
    metrics: [
      ["Bereik", "12.840"],
      ["Engagement", "6,8%"],
      ["Nieuwe volgers", "+84"],
      ["Beste post", "Weekendactie"],
    ],
    link: "Bekijk Instagram-inzichten",
  },
  email: {
    title: "E-mail",
    metrics: [
      ["Click rate", "4,6%"],
      ["Verzonden", "4.850"],
      ["Nieuwe contacten", "+126"],
      ["Uitschrijvingen", "8"],
    ],
    link: "Bekijk e-mail-inzichten",
  },
};
export type Channel = "Overzicht" | "Instagram" | "E-mail";
export type Period = 7 | 30 | 90;
export function performance(channel: Channel, period: Period) {
  const factor = period === 7 ? 0.26 : period === 90 ? 2.72 : 1;
  const email = channel === "E-mail";
  return [
    {
      label: email ? "Clicks" : "Bereik",
      value: Math.round((email ? 223 : 12840) * factor),
      suffix: "",
      trend: "+18%",
    },
    {
      label: email ? "Click rate" : "Engagement",
      value: email ? 4.6 : 6.8,
      suffix: "%",
      trend: "+0,8 pp",
    },
    {
      label: email ? "Verzonden" : "Clicks",
      value: Math.round((email ? 4850 : 486) * factor),
      suffix: "",
      trend: "+9%",
    },
  ];
}
export function chartValues(channel: Channel, period: Period, metric: number) {
  const shapes = [
    [18, 26, 23, 37, 31, 44, 40, 58, 49, 63, 57, 78],
    [12, 24, 20, 31, 29, 38, 46, 41, 54, 48, 67, 74],
    [25, 20, 33, 29, 45, 36, 51, 46, 65, 57, 70, 82],
  ];
  const stats = performance(channel, period);
  const shape =
    shapes[
      (metric + (channel === "E-mail" ? 1 : 0) + (period === 7 ? 1 : 0)) % 3
    ];
  const scale =
    stats[metric].suffix === "%"
      ? stats[metric].value / 55
      : stats[metric].value / 500;
  return shape.map((x) => Math.round(x * scale * 10) / 10);
}

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
    href: "/email-ai?tab=create&campaign=" + encodeURIComponent(c.id),
    variant: 2,
    local: true,
  }));
}
