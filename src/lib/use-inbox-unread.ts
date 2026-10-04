"use client";
import { useEffect, useState } from "react";
import { isBrowserDemo } from "@/lib/demo";

export const INBOX_UNREAD_EVENT = "mavix:inbox-unread";

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
      fetch("/api/inbox/unread")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled && d && typeof d.unread === "number") setCount(d.unread);
        })
        .catch(() => {});
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
