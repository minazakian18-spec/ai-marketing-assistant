"use client";
import { useEffect, useState } from "react";
import { isBrowserDemo } from "@/lib/demo";

export type Connection = { provider: string; status: string; display_name?: string };

// Real integration status from the server. In demo mode (or on any error) the
// API refuses the request and everything is treated as not connected.
// One request at a time is shared; a list younger than 30 seconds is reused.
let shared: { at: number; value: Promise<Connection[]> } | null = null;
function loadConnections(): Promise<Connection[]> {
  if (shared && Date.now() - shared.at < 30_000) return shared.value;
  const value = fetch("/api/integrations")
    .then(async (r) => (r.ok ? (await r.json()).connections || [] : []))
    .catch(() => []);
  shared = { at: Date.now(), value };
  return value;
}
export function useConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (isBrowserDemo()) {
      setLoaded(true);
      return;
    }
    void loadConnections().then((list: Connection[]) => {
        if (cancelled) return;
        setConnections(list);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const status = (provider: string) =>
    connections.find((c) => c.provider === provider)?.status || "disconnected";
  return { connections, loaded, status };
}
