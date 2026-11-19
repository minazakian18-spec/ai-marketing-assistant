"use client";
import { useEffect, useState } from "react";
import { isBrowserDemo } from "@/lib/demo";

export const INBOX_UNREAD_EVENT = "mavix:inbox-unread";

// Every component that shows the badge (desktop and mobile sidebar) shares
// one request: a count younger than 20 seconds, or one still loading, is reused.
let shared: { at: number; value: Promise<number | null> } | null = null;
function unreadCount(): Promise<number | null> {
  if (shared && Date.now() - shared.at < 20_000) return shared.value;
  const value = fetch("/api/inbox/unread")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d && typeof d.unread === "number" ? (d.unread as number) : null))
    .catch(() => null);
  shared = { at: Date.now(), value };
  return value;
}

// Number of conversations with unread messages for the sidebar badge.
// Polls once a minute while the tab is visible; the Inbox page pushes fresh
// counts through a window event. Not shown in demo mode.
export function useInboxUnread() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (isBrowserDemo()) return;
    let cancelled = false;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      void unreadCount().then((n) => {
        if (!cancelled && n !== null) setCount(n);
      });
    };
    const pushed = (e: Event) => {
      const n = (e as CustomEvent<number>).detail;
      if (typeof n === "number") setCount(n);
    };
    load();
    const timer = window.setInterval(load, 60000);
    window.addEventListener(INBOX_UNREAD_EVENT, pushed);
    document.addEventListener("visibilitychange", load);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(INBOX_UNREAD_EVENT, pushed);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);
  return count;
}
