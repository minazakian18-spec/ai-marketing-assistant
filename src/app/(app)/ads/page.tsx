"use client";
import Link from "next/link";
import { ArrowRight, BarChart3, Check, Clock, ExternalLink, LineChart, ListChecks, MousePointerClick, Percent, ShieldCheck, Sparkles, Target, Wallet } from "lucide-react";
import { BrandIcon } from "@/components/brand-icon";
import { useWorkspace } from "@/components/workspace-provider";
import { readiness } from "@/lib/instagram-model";
import { useState } from "react";
import { GoogleAdsConnect } from "@/components/ads/google-ads-connect";
import { AdsDashboard } from "@/components/ads/ads-dashboard";

// Google Ads: connect an account, then real results (last 30 days vs the 30
// before, weekly trend, campaigns, search terms) and AI proposals based on
// those numbers and the Brand Hub (components/ads/ads-dashboard.tsx).
// Read-only: Mavix never creates or changes campaigns.

type Step = { title: string; text: string; state: "done" | "todo" | "later"; action?: { label: string; href: string; external?: boolean }; connect?: boolean };

const PLANNED: { icon: typeof BarChart3; title: string; text: string }[] = [
  { icon: BarChart3, title: "Campagne-overzicht", text: "Uitgaven, klikken, CTR, CPC en conversies per campagne, met de vorige periode ernaast." },
  { icon: LineChart, title: "Trends", text: "Hoe je resultaten zich per week ontwikkelen, gemeten door Google Ads." },
  { icon: Sparkles, title: "Voorstellen van Mavix", text: "Advertentieteksten en zoekwoorden op basis van je Brand Hub, als concept dat jij goedkeurt." },
  { icon: ShieldCheck, title: "Veilig beheer", text: "Mavix wijzigt of start nooit een campagne zonder jouw uitdrukkelijke goedkeuring." },
];
const METRICS: { icon: typeof Wallet; label: string }[] = [
  { icon: Wallet, label: "Uitgaven" },
  { icon: MousePointerClick, label: "Klikken" },
  { icon: Percent, label: "CTR" },
  { icon: Target, label: "CPC" },
  { icon: Check, label: "Conversies" },
];

export default function AdsPage() {
  const { data, ready } = useWorkspace();
  const brand = ready ? readiness(data.profile).score : 0;
  const website = !!data.profile.website?.trim();
  const [linked, setLinked] = useState(false);
  // Your part: what you can already prepare. The connection itself follows
  // once Mavix's Google Ads API access is approved.
  const steps: Step[] = [
    {
      title: "Brand Hub voor minstens 80% compleet",
      text: `Nu ${Math.round(brand)}%. Mavix gebruikt je Brand Hub voor advertentievoorstellen.`,
      state: brand >= 80 ? "done" : "todo",
      action: { label: "Brand Hub aanvullen", href: "/brand-hub" },
    },
    { title: "Website ingevuld in Brand Hub", text: "Nodig voor advertenties die naar je site linken.", state: website ? "done" : "todo", action: { label: "Website toevoegen", href: "/brand-hub" } },
    {
      title: "Koppel je Google Ads-account",
      text: "Heb je al een Google Ads-account (bijvoorbeeld voor je zaak)? Log in met Google en kies het account. Mavix leest alleen mee en wijzigt niets. Nog geen account? Maak het eerst aan bij Google Ads.",
      state: linked ? "done" : "todo",
      connect: true,
    },
  ];
  const ownSteps = steps.filter((s) => s.state !== "later");
  const done = ownSteps.filter((s) => s.state === "done").length;

  return (
    <div className="ads">
      <header className="ads-hero">
        <span className="ads-logo" aria-hidden="true">
          <BrandIcon brand="google_ads" size={28} />
        </span>
        <div className="ads-hero-text">
                    <h1>Google Ads</h1>
          <p>Je campagnes, uitgaven en resultaten naast je andere marketing, met voorstellen van Mavix die jij goedkeurt.</p>
        </div>
      </header>

      {linked && <AdsDashboard />}

      {!linked && (
        <section className="ads-card ads-connection" aria-labelledby="ads-connection">
          <div className="ads-connection-head">
            <span className="ads-dot" aria-hidden="true" />
            <h2 id="ads-connection">Nog niet verbonden</h2>
          </div>
          <p className="ads-lead">Koppel je Google Ads-account hieronder. Daarna zie je hier je echte cijfers en maakt Mavix voorstellen op basis van je resultaten en je Brand Hub. Mavix leest alleen mee; je kunt de toegang altijd intrekken.</p>
        </section>
      )}

      <section className="ads-card" aria-labelledby="ads-steps">
        <div className="ads-section-head">
          <div>
            <h2 id="ads-steps">
              <ListChecks size={17} aria-hidden="true" /> {linked ? "Koppeling" : "Klaar voor de koppeling"}
            </h2>
            <p>{linked ? "Je account en wat Mavix gebruikt voor de voorstellen." : "Wat je nu al kunt voorbereiden."}</p>
          </div>
          <span className="ads-progress" aria-label={`${done} van ${ownSteps.length} stappen klaar`}>
            {done}/{ownSteps.length} klaar
          </span>
        </div>
        <ol className="ads-steps">
          {steps.map((s, i) => (
            <li key={s.title} className={"is-" + s.state}>
              <span className="ads-step-mark" aria-hidden="true">
                {s.state === "done" ? <Check size={14} strokeWidth={3} /> : s.state === "later" ? <Clock size={13} /> : i + 1}
              </span>
              <div className="ads-step-text">
                <strong>{s.title}</strong>
                <span>{s.text}</span>
                {s.connect && <GoogleAdsConnect onChange={setLinked} />}
              </div>
              <span className="ads-step-state">{s.state === "done" ? "Klaar" : s.state === "later" ? "Volgt" : "Te doen"}</span>
              {s.connect ? (
                <span className="ads-step-action" aria-hidden="true" />
              ) : s.action && s.state === "todo" ? (
                s.action.external ? (
                  <a className="button secondary ads-step-action" href={s.action.href} target="_blank" rel="noopener noreferrer">
                    {s.action.label} <ExternalLink size={13} aria-hidden="true" />
                  </a>
                ) : (
                  <Link className="button secondary ads-step-action" href={s.action.href}>
                    {s.action.label} <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                )
              ) : (
                <span className="ads-step-action" aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
      </section>

      {!linked && (
      <>
      <section aria-labelledby="ads-plan">
        <div className="ads-section-head ads-section-head-plain">
          <div>
            <h2 id="ads-plan">Wat je krijgt</h2>
            <p>Zodra Google Ads gekoppeld is.</p>
          </div>
        </div>
        <ul className="ads-features">
          {PLANNED.map((f) => (
            <li key={f.title} className="ads-card">
              <span className="ads-feature-icon" aria-hidden="true">
                <f.icon size={18} />
              </span>
              <strong>{f.title}</strong>
              <span>{f.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="ads-card ads-preview" aria-labelledby="ads-future">
        <div className="ads-section-head">
          <div>
            <h2 id="ads-future">Zo ziet je overzicht eruit</h2>
            <p>Voorbeeld van de indeling. Dit zijn geen echte cijfers.</p>
          </div>
          <span className="ads-sample">Voorbeeldweergave</span>
        </div>
        <div className="ads-preview-body" aria-hidden="true">
          <div className="ads-kpis">
            {METRICS.map((m) => (
              <div key={m.label}>
                <span>
                  <m.icon size={13} /> {m.label}
                </span>
                <strong>—</strong>
                <em>na koppeling</em>
              </div>
            ))}
          </div>
          <div className="ads-chart">
            <span className="ads-chart-label">Trend per week</span>
            <div className="ads-chart-bars">
              {[38, 52, 46, 60, 55, 70, 64, 76].map((h, i) => (
                <i key={i} style={{ height: h + "%" }} />
              ))}
            </div>
          </div>
          <div className="ads-table">
            <div className="ads-table-row is-head">
              <span>Campagne</span>
              <span>Uitgaven</span>
              <span>Klikken</span>
              <span>CTR</span>
              <span>CPC</span>
              <span>Conversies</span>
            </div>
            {[0, 1, 2].map((r) => (
              <div key={r} className="ads-table-row">
                {[0, 1, 2, 3, 4, 5].map((c) => (
                  <span key={c}>
                    <i />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
      </>
      )}
    </div>
  );
}
