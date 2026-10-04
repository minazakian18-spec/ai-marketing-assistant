"use client";
import { useEffect, useState } from "react";
import { isBrowserDemo } from "@/lib/demo";

export type Connection = { provider: string; status: string; display_name?: string };

// Real integration status from the server. In demo mode (or on any error) the
// API refuses the request and everything is treated as not connected.
export function useConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (isBrowserDemo()) {
      setLoaded(true);
      return;
    }
    fetch("/api/integrations")
      .then(async (r) => (r.ok ? (await r.json()).connections || [] : []))
      .catch(() => [])
      .then((list: Connection[]) => {
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
