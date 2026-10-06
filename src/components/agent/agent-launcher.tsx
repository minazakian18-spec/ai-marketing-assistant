"use client";
import { usePathname, useRouter } from "next/navigation";
import { Mavi } from "@/components/mavi";
import { useAgent } from "./agent-provider";

// Compact top-bar entry to the Mavix Agent, next to the account menu.
// Opens the side panel; on the /agent page it focuses the page composer.
export function AgentLauncher() {
  const { panelOpen, openPanel, closePanel, busy } = useAgent();
  const pathname = usePathname();
  const router = useRouter();
  const onPage = pathname === "/agent";
  return (
    <button
      type="button"
      className={"agent-launcher" + (panelOpen || onPage ? " is-active" : "")}
      aria-haspopup="dialog"
      aria-expanded={panelOpen}
      aria-controls="mavix-agent-panel"
      title="Mavix Agent (Ctrl+K)"
      onClick={() => {
        if (onPage) {
          document.querySelector<HTMLTextAreaElement>(".agent-page textarea")?.focus();
          return router.push("/agent");
        }
        if (panelOpen) closePanel();
        else openPanel();
      }}
    >
      <Mavi size={16} state={busy ? "thinking" : "idle"} />
      <span>Agent</span>
    </button>
  );
}
