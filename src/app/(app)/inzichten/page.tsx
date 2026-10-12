"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChartNoAxesColumn, Plug } from "lucide-react";
import { ResearchSection } from "@/components/research/research-section";
import { useWorkspace } from "@/components/workspace-provider";
import { isBrowserDemo } from "@/lib/demo";
import "../../research.css";
import "../../insights.css";

// Inzichten: how marketing performs and what Mavix can discover. No approval
// queue, planning or automation status here: those live on the Dashboard,
// Calendar and in the channel modules.
//
// Performance numbers are only shown when a connected integration really
// delivers them. Today no channel exposes reach or engagement to Mavix yet,
// so the section says so once, depending on what is connected.

const LABEL: Record<string, string> = {
  instagram: "Instagram",
  messenger: "Facebook Messenger",
  gmail: "Gmail",
  whatsapp: "WhatsApp",
  google_business: "Google Bedrijfsprofiel",
  google_search_console: "Google Search Console",
  google_calendar: "Google Agenda",
};
// Channels whose statistics Mavix will read once supported (marketing results).
const ANALYTICS = ["instagram", "google_business", "google_search_console"];

type Conn = { provider: string; status: string };

export default function Insights() {
  const { ready } = useWorkspace();
  const [connections, setConnections] = useState<Conn[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isBrowserDemo()) {
      setConnections([]);
      return;
    }
    let active = true;
    fetch("/api/integrations", { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error();
        if (active) setConnections(body.connections || []);
      })
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  if (!ready) return <p role="status">Inzichten laden…</p>;
  const connected = (connections || []).filter((c) => c.status === "connected" && ANALYTICS.includes(c.provider)).map((c) => LABEL[c.provider] || c.provider);

  return (
    <div className="ins">
      <header className="ins-head">
        <h1>Inzichten</h1>
        <p>Ontdek hoe je marketing presteert en waar je kunt groeien.</p>
      </header>

      <section className="ins-section" aria-labelledby="ins-performance">
        <h2 id="ins-performance">Marketingresultaten</h2>
        {connections === null && !error ? (
          <div className="ins-skeleton" aria-busy="true" aria-label="Laden">
            <span />
            <span />
          </div>
        ) : error ? (
          <p className="ins-error" role="alert">
            Je koppelingen konden niet worden geladen. Probeer het later opnieuw.
          </p>
        ) : (
          <div className="ins-empty">
            <span className="ins-empty-icon" aria-hidden="true">
              <ChartNoAxesColumn size={18} />
            </span>
            <div>
              <strong>Nog geen marketinggegevens beschikbaar</strong>
              <p>
                {connected.length
                  ? `${connected.join(" en ")} ${connected.length === 1 ? "is" : "zijn"} gekoppeld, maar Mavix leest bereik en interacties nog niet uit. Zodra dat kan, zie je hier je resultaten en trends.`
                  : "Koppel een kanaal om je resultaten en trends te bekijken."}
              </p>
            </div>
            {!connected.length && (
              <Link href="/account/integraties" className="button secondary">
                <Plug size={15} />
                Integraties bekijken
              </Link>
            )}
          </div>
        )}
      </section>

      <ResearchSection />
    </div>
  );
}
