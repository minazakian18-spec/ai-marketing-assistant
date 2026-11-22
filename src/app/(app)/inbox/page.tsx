import { redirect } from "next/navigation";

// The Inbox lives inside the channels now: Social > Berichten (Instagram)
// and E-mail > Inbox. Old links (notifications, bookmarks) land there.
export default async function InboxRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const channel = typeof q.channel === "string" ? q.channel : "";
  const rest = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (typeof v === "string" && k !== "channel" && k !== "tab") rest.set(k, v);
  const extra = rest.toString() ? "&" + rest.toString() : "";
  redirect(channel === "gmail" ? "/email?tab=inbox" + extra : "/social?tab=inbox" + extra);
}
