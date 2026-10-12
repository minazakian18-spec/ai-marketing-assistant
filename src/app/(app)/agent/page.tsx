"use client";
import { Suspense } from "react";
import { AgentWorkspace } from "@/components/agent/agent-workspace";
import "../../agent.css";

// Mavix Agent: persistent conversation workspace (see agent-workspace.tsx).
export default function AgentPage() {
  return (
    <Suspense fallback={<p role="status">Mavix Agent laden…</p>}>
      <AgentWorkspace />
    </Suspense>
  );
}
