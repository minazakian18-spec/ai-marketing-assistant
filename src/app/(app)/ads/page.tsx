"use client";
import Link from "next/link";
import { ArrowRight, BarChart3, Check, Clock, ExternalLink, LineChart, ListChecks, MousePointerClick, Percent, ShieldCheck, Sparkles, Target, Wallet } from "lucide-react";
import { BrandIcon } from "@/components/brand-icon";
import { useWorkspace } from "@/components/workspace-provider";
import { readiness } from "@/lib/instagram-model";

// Google Ads: planned module. There is no Google Ads API connection in Mavix
// yet, so this page shows what the module will do, what is needed, and the
// layout of the future overview WITHOUT numbers. Mavix never creates or
// changes campaigns without explicit approval.
//
// Access to the Google Ads API (since 9 September 2026): no developer token;
// access belongs to the Google Cloud project of Mavix's OAuth client, at an
// access level (Test, Explorer, Basic, Standard) requested on the Google Ads
// API Overview page in the Cloud Console. New Basic/Standard applications need
// brand verification. A manager account is no longer required.

type Step = { title: string; text: string; state: "done" | "todo" | "later"; action?: { label: string; href: string; external?: boolean } };

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
      title: "Een Google Ads-account met betaalgegevens",
      text: "Heb je er nog geen? Maak het zelf aan bij Google. Mavix maakt geen accounts aan en kan dit niet voor je controleren tot de koppeling er is.",
      state: "todo",
      action: { label: "Naar Google Ads", href: "https://ads.google.com", external: true },
    },
    { title: "Google Ads koppelen aan Mavix", text: "Je logt in met Google en kiest welk account Mavix mag lezen. Kan zodra Mavix toegang tot de Google Ads API heeft.", state: "later" },
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
          <p className="ads-eyebrow">Marketing</p>
          <h1>Google Ads</h1>
          <p>Zie straks je campagnes, uitgaven en resultaten naast je andere marketing, met voorstellen van Mavix die jij goedkeurt.</p>
        </div>
        <span className="ads-badge">
          <Clock size={13} aria-hidden="true" /> In ontwikkeling
        </span>
      </header>

      <section className="ads-card ads-connection" aria-labelledby="ads-connection">
        <div className="ads-connection-head">
          <span className="ads-dot" aria-hidden="true" />
          <h2 id="ads-connection">Nog niet verbonden</h2>
        </div>
        <p className="ads-lead">De koppeling met Google Ads is in voorbereiding. Er worden geen cijfers getoond tot je Google Ads-account echt gekoppeld is.</p>
        <div className="ads-split">
          <div>
            <h3>Wat Mavix regelt</h3>
            <ul>
              <li>Toegang tot de Google Ads API voor het Google Cloud-project van Mavix, op een toegangsniveau voor echte advertentieaccounts (Basic of Standard).</li>
              <li>De merkverificatie die Google voor die toegang vraagt.</li>
              <li>De goedkeuring van het Google-inlogscherm waarmee je straks koppelt.</li>
            </ul>
            <p className="ads-muted">Nog niet afgerond. Jij hoeft hiervoor niets te doen: geen developer token en geen managementaccount (MCC).</p>
          </div>
          <div>
            <h3>Wat jij straks doet</h3>
            <ul>
              <li>Inloggen met je Google-account en toestemming geven.</li>
              <li>Kiezen welk Google Ads-account Mavix mag lezen.</li>
            </ul>
            <p className="ads-muted">Je kunt de toegang altijd weer intrekken, in Mavix of in je Google-account.</p>
          </div>
        </div>
      </section>

      <section className="ads-card" aria-labelledby="ads-steps">
        <div className="ads-section-head">
          <div>
            <h2 id="ads-steps">
              <ListChecks size={17} aria-hidden="true" /> Klaar voor de koppeling
            </h2>
            <p>Wat je nu al kunt voorbereiden.</p>
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
              </div>
              <span className="ads-step-state">{s.state === "done" ? "Klaar" : s.state === "later" ? "Volgt" : "Te doen"}</span>
              {s.action && s.state === "todo" ? (
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

      <section aria-labelledby="ads-plan">
        <div className="ads-section-head ads-section-head-plain">
          <div>
            <h2 id="ads-plan">Wat de module gaat doen</h2>
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
            <h2 id="ads-future">Zo ziet je overzicht er straks uit</h2>
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
    </div>
  );
}
