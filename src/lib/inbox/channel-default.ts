import type { Channel } from "./shared";

// The Inbox is channel-first: there is always one channel selected. This
// decides which one when the Inbox opens.

export const CHANNEL_ORDER: Channel[] = ["instagram", "whatsapp", "gmail", "messenger"];
export const INBOX_CHANNEL_KEY = "mavix.inbox.channel";

type State = "not_connected" | "connected" | "reconsent" | "reconnect" | "selection" | "error";

/**
 * 1. The channel the user chose last time, if it is still connected.
 * 2. Otherwise the connected channel with the most unread conversations
 *    (ties: the usual channel order).
 * 3. Otherwise a linked channel that needs attention (so its repair prompt shows).
 * 4. Otherwise the last choice, or Instagram, which then shows its connect prompt.
 */
export function defaultChannel(channels: { channel: Channel; state: State }[], unread: Partial<Record<Channel, number>>, remembered?: string | null): Channel {
  const state = (c: Channel) => channels.find((x) => x.channel === c)?.state ?? "not_connected";
  const valid = (c?: string | null): c is Channel => !!c && (CHANNEL_ORDER as string[]).includes(c);
  if (valid(remembered) && state(remembered) === "connected") return remembered;
  const connected = CHANNEL_ORDER.filter((c) => state(c) === "connected");
  if (connected.length) return [...connected].sort((a, b) => (unread[b] || 0) - (unread[a] || 0) || CHANNEL_ORDER.indexOf(a) - CHANNEL_ORDER.indexOf(b))[0];
  const linked = CHANNEL_ORDER.find((c) => state(c) !== "not_connected");
  if (linked) return linked;
  return valid(remembered) ? remembered : CHANNEL_ORDER[0];
}
