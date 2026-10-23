"use client";
import Link from "next/link";
import { CheckCircle2, Circle, Clock, Megaphone } from "lucide-react";
import { PageHeading } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { readiness } from "@/lib/instagram-model";

// Google Ads: planned module. There is no Google Ads API connection in Mavix
// yet, so this page shows what the module will do, what is needed, and the
// layout of the future overview WITHOUT numbers. Mavix never creates or
// changes campaigns without explicit approval.

const PLANNED = [
  ["Campagne-overzicht", "Uitgaven, klikken, CTR, CPC en conversies per campagne, met de vorige periode ernaast."],
  ["Trends", "Hoe je resultaten zich per week ontwikkelen, gemeten door Google Ads."],
  ["Voorstellen van Mavix", "Advertentieteksten en zoekwoorden op basis van je Brand Hub, als concept dat jij goedkeurt."],
  ["Veilig beheer", "Mavix wijzigt of start nooit een campagne zonder jouw uitdrukkelijke goedkeuring."],
] as const;
const FUTURE = ["Uitgaven", "Klikken", "CTR", "CPC", "Conversies"];

export default function AdsPage() {
  const { data, ready } = useWorkspace();
  const brand = ready ? readiness(data.profile).score : 0;
  const checklist: { label: string; state: "done" | "todo" | "mavix"; note: string; href?: string }[] = [
    { label: "Google Ads API-toegang voor Mavix", state: "mavix", note: "Google moet Mavix eerst toegang geven (developer token). Dit regelt Mavix; jij hoeft niets te doen." },
    { label: "Een Google Ads-account met betaalgegevens", state: "todo", note: "Heb je nog geen account? Maak het aan op ads.google.com. Mavix maakt geen accounts voor je aan." },
    { label: "Website ingevuld in Brand Hub", state: data.profile.website?.trim() ? "done" : "todo", note: "Nodig voor advertenties die naar je site linken.", href: "/brand-hub" },
    { label: "Brand Hub voor minstens 80% compleet", state: brand >= 80 ? "done" : "todo", note: `Nu ${Math.round(brand)}%. Mavix gebruikt dit voor advertentievoorstellen.`, href: "/brand-hub" },
  ];
  return (
    <div className="ads">
      <PageHeading eyebrow="Marketing" title="Google Ads" description="Zie straks je campagnes, uitgaven en resultaten naast je andere marketing." />

      <section className="panel ads-status" aria-labelledby="ads-status">
        <span className="ws-empty-icon" aria-hidden="true">
          <Megaphone size={22} />
        </span>
        <div>
          <h2 id="ads-status">Nog niet beschikbaar</h2>
          <p>De koppeling met Google Ads is in voorbereiding. Hieronder zie je wat er nodig is en wat de module gaat doen. Er worden geen cijfers getoond tot Google Ads echt gekoppeld is.</p>
        </div>
      </section>

      <section className="panel ads-section" aria-labelledby="ads-check">
        <h2 id="ads-check">Klaar voor de koppeling?</h2>
        <ul className="ads-check">
          {checklist.map((c) => {
            const Icon = c.state === "done" ? CheckCircle2 : c.state === "mavix" ? Clock : Circle;
            return (
              <li key={c.label} className={"is-" + c.state}>
                <Icon size={16} aria-hidden="true" />
                <div>
                  <strong>{c.label}</strong>
                  <span>{c.note}</span>
                </div>
                {c.href && c.state === "todo" && (
                  <Link className="text-link" href={c.href}>
                    Aanvullen
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel ads-section" aria-labelledby="ads-plan">
        <h2 id="ads-plan">Wat de module gaat doen</h2>
        <ul className="ads-plan">
          {PLANNED.map(([t, d]) => (
            <li key={t}>
              <strong>{t}</strong>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel ads-section" aria-labelledby="ads-future">
        <h2 id="ads-future">Zo ziet je overzicht er straks uit</h2>
        <p className="ads-note">Voorbeeld van de indeling. Dit zijn geen echte cijfers.</p>
        <div className="ads-future" aria-hidden="true">
          {FUTURE.map((m) => (
            <div key={m}>
              <span>{m}</span>
              <em>na koppeling</em>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
