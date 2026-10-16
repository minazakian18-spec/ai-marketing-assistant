"use client";
import { ResearchSection } from "@/components/research/research-section";
import { MarketingResults } from "@/components/research/marketing-results";
import { useWorkspace } from "@/components/workspace-provider";
import "../../research.css";
import "../../insights.css";

// Inzichten: what to do next, measured marketing results per source (with
// comparison periods and the source named), goals, and the business research
// (observed facts vs. interpretation). No approval queue or automation here:
// those live on the Dashboard, Calendar and in the channel modules. The full
// SEO dashboard stays in SEO Intelligence.
export default function Insights() {
  const { ready } = useWorkspace();
  if (!ready) return <p role="status">Inzichten laden…</p>;
  return (
    <div className="ins">
      <header className="ins-head">
        <h1>Inzichten</h1>
        <p>Ontdek hoe je marketing presteert en waar je kunt groeien.</p>
      </header>
      <MarketingResults />
      <ResearchSection />
    </div>
  );
}
