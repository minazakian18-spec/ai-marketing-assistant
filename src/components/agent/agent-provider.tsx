"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { MaviState } from "@/components/mavi";

// One Mavix Agent for the whole app. The dashboard input and the top-bar
// panel do not keep their own chat: asking anywhere hands the prompt to the
// persistent workspace on /agent (stored conversations in Supabase), which
// sends it. The handoff lives in memory and sessionStorage, so it survives
// the client-side navigation and a reload, and is consumed exactly once.
const HANDOFF_KEY = "mavix-agent-handoff";

type AgentContext = {
  state: MaviState;
  busy: boolean;
  /** Ask from anywhere: opens /agent and sends the prompt there. */
  ask: (text: string) => void;
  /** For the /agent workspace: take the prompt handed over, if any. */
  takeHandoff: () => string | null;
  /** The /agent workspace reports real request activity (Mavi animation). */
  setActivity: (state: MaviState) => void;
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
};

const Context = createContext<AgentContext | null>(null);

export function AgentProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<MaviState>("idle");
  const [panelOpen, setPanelOpen] = useState(false);
  const pending = useRef<string | null>(null);

  const ask = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q) return;
      pending.current = q;
      try {
        sessionStorage.setItem(HANDOFF_KEY, q);
      } catch {
        /* the in-memory handoff still works */
      }
      setPanelOpen(false);
      router.push("/agent?handoff=1");
    },
    [router],
  );

  const takeHandoff = useCallback(() => {
    let q = pending.current;
    try {
      q ??= sessionStorage.getItem(HANDOFF_KEY);
      sessionStorage.removeItem(HANDOFF_KEY);
    } catch {
      /* ignore */
    }
    pending.current = null;
    return q;
  }, []);

  // Keyboard shortcut: Ctrl/⌘ + K toggles the panel (not on /agent itself).
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && pathname !== "/agent") {
        e.preventDefault();
        setPanelOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [pathname]);

  // The full workspace replaces the panel.
  useEffect(() => {
    if (pathname === "/agent") setPanelOpen(false);
  }, [pathname]);

  const value = useMemo(
    () => ({
      state,
      busy: state === "thinking",
      ask,
      takeHandoff,
      setActivity: setState,
      panelOpen,
      openPanel: () => setPanelOpen(true),
      closePanel: () => setPanelOpen(false),
    }),
    [state, ask, takeHandoff, panelOpen],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAgent() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useAgent must be used inside AgentProvider");
  return ctx;
}
