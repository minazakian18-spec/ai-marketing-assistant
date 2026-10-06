"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useWorkspace } from "@/components/workspace-provider";
import { runAgent, type AgentMessage } from "@/lib/agent/engine";
import type { AgentAttachment } from "@/lib/agent-handoff";
import type { MaviState } from "@/components/mavi";

// One Mavix Agent for the whole app: the top-bar panel, the dashboard
// surface and the /agent page all read and write this conversation, so a
// question started anywhere continues everywhere.
type AgentContext = {
  messages: AgentMessage[];
  state: MaviState;
  busy: boolean;
  ask: (text: string, attachments?: AgentAttachment[]) => void;
  reset: () => void;
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
};

const Context = createContext<AgentContext | null>(null);
let seq = 0;
const id = () => "m" + ++seq + "-" + Date.now().toString(36);

export function AgentProvider({ children }: { children: ReactNode }) {
  const { data } = useWorkspace();
  const pathname = usePathname();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [state, setState] = useState<MaviState>("idle");
  const [panelOpen, setPanelOpen] = useState(false);
  const previews = useRef<string[]>([]);
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const ask = useCallback(
    (text: string, attachments: AgentAttachment[] = []) => {
      const q = text.trim();
      if (!q && !attachments.length) return;
      for (const a of attachments) if (a.preview) previews.current.push(a.preview);
      const info = attachments.map((a) => ({ name: a.file.name, kind: a.kind, preview: a.preview }));
      setMessages((m) => [...m, { id: id(), role: "user", text: q, attachments: info }]);
      setState("thinking");
      runAgent({ text: q, attachments: info, page: pathname }, dataRef.current)
        .then((reply) => setMessages((m) => [...m, { id: id(), role: "agent", ...reply }]))
        .catch(() => setMessages((m) => [...m, { id: id(), role: "agent", text: "Er ging iets mis. Probeer het opnieuw." }]))
        .finally(() => setState("done"));
    },
    [pathname],
  );

  const reset = useCallback(() => {
    previews.current.forEach((u) => URL.revokeObjectURL(u));
    previews.current = [];
    setMessages([]);
    setState("idle");
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

  // The full page replaces the panel.
  useEffect(() => {
    if (pathname === "/agent") setPanelOpen(false);
  }, [pathname]);

  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const value = useMemo(
    () => ({
      messages,
      state,
      busy: state === "thinking",
      ask,
      reset,
      panelOpen,
      openPanel: () => setPanelOpen(true),
      closePanel: () => setPanelOpen(false),
    }),
    [messages, state, ask, reset, panelOpen],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAgent() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useAgent must be used inside AgentProvider");
  return ctx;
}
