import type { Post, Workspace } from "./types";
import type { EmailCampaign } from "./email-model";

export type CalendarChannel = "Instagram" | "E-mail";
export type CalendarStatus =
  | "review"
  | "approved"
  | "scheduled"
  | "published"
  | "rejected"
  | "blocked"
  | "failed";
export type CalendarSource =
  | { kind: "post"; id: string }
  | { kind: "email"; id: string };
export type CalendarItem = {
  id: string;
  title: string;
  channel: CalendarChannel;
  contentType: string;
  status: CalendarStatus;
  date: string;
  time: string;
  mediaUrl: string;
  caption: string;
  createdBy: "user" | "mavix-ai";
  automated: boolean;
  href: string;
  variant: number;
  source: CalendarSource;
};

function splitLocal(date: string): { date: string; time: string } {
  if (!date) return { date: "", time: "" };
  const [d, t] = date.split("T");
  return { date: d || "", time: (t || "").slice(0, 5) };
}

function postToItem(p: Post): CalendarItem {
  const { date, time } = splitLocal(p.date);
  return {
    id: "post-" + p.id,
    title: p.prompt,
    channel: "Instagram",
    contentType: p.contentType || "Post",
    status: p.status === "draft" ? "review" : p.status,
    date,
    time,
    mediaUrl: p.media?.[0] || "",
    caption: p.caption,
    createdBy: p.source === "autopilot" ? "mavix-ai" : "user",
    automated: p.source === "autopilot",
    href: "/social?post=" + encodeURIComponent(p.id),
    variant: p.variant,
    source: { kind: "post", id: p.id },
  };
}

function emailToItem(c: EmailCampaign): CalendarItem {
  const { date, time } = splitLocal(c.date);
  return {
    id: "email-" + c.id,
    title: c.title,
    channel: "E-mail",
    contentType: c.kind.replace("Create ", ""),
    status: c.status === "draft" ? "review" : c.status === "sent" ? "published" : c.status,
    date,
    time,
    mediaUrl: c.hero || "",
    caption: c.subject,
    createdBy: c.source === "autopilot" ? "mavix-ai" : "user",
    automated: c.source === "autopilot",
    href: "/email?tab=create&campaign=" + encodeURIComponent(c.id),
    variant: c.variant,
    source: { kind: "email", id: c.id },
  };
}

export function toCalendarItems(data: Workspace): CalendarItem[] {
  return [
    ...data.posts.map(postToItem),
    ...(data.email?.campaigns || []).map(emailToItem),
  ];
}

export function statusMeta(status: CalendarStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "review":
      return { label: "Wacht op jouw goedkeuring", className: "cal-review" };
    case "approved":
      return { label: "Goedgekeurd", className: "cal-approved" };
    case "scheduled":
      return { label: "Ingepland", className: "cal-scheduled" };
    case "published":
      return { label: "Gepubliceerd", className: "cal-published" };
    case "rejected":
      return { label: "Afgewezen", className: "cal-rejected" };
    case "blocked":
      return { label: "Geblokkeerd", className: "cal-blocked" };
    case "failed":
      return { label: "Mislukt", className: "cal-blocked" };
  }
}
