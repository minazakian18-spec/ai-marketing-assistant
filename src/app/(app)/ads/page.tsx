import Link from "next/link";
import { Megaphone, Plug } from "lucide-react";
import { PageHeading } from "@/components/ui";

const METRICS = ["Uitgaven", "Klikken", "CTR", "CPC", "Conversies"];

export default function AdsPage() {
  return (
    <div className="ads">
      <PageHeading
        eyebrow="Marketing"
        title="Advertenties"
        description="Je advertentiecampagnes, uitgaven en resultaten."
      />
      <section className="ws-metrics" aria-label="Advertentiecijfers">
        {METRICS.map((label) => (
          <article key={label} className="ws-metric">
            <span>{label}</span>
            <strong>—</strong>
          </article>
        ))}
      </section>
      <section className="panel ws-empty">
        <span className="ws-empty-icon">
          <Megaphone size={22} />
        </span>
        <h2>Koppel Google Ads</h2>
        <p>
          Zodra Google Ads gekoppeld is, zie je hier je campagnes, uitgaven en
          resultaten. De Google Ads-koppeling komt binnenkort beschikbaar.
        </p>
        <Link className="button secondary" href="/account/integraties">
          <Plug size={15} />
          Integraties bekijken
        </Link>
      </section>
    </div>
  );
}
