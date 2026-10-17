import { BrandIcon, type Brand } from "@/components/brand-icon";
import { Reveal } from "./reveal";

// Platforms Mavix connects with. Some connections still wait for approval by
// Google or Meta; the app shows the live status per connection.
const integrations: { brand: Brand; name: string; use: string; soon?: boolean }[] = [
  { brand: "google_business", name: "Google Bedrijfsprofiel", use: "Reviews lezen en beantwoorden" },
  { brand: "instagram", name: "Instagram", use: "Posts en carrousels inplannen" },
  { brand: "gmail", name: "Gmail", use: "E-mail in je Inbox" },
  { brand: "whatsapp", name: "WhatsApp Business", use: "Klantgesprekken" },
  { brand: "messenger", name: "Facebook Messenger", use: "Klantgesprekken" },
  { brand: "google_calendar", name: "Google Agenda", use: "Afspraken in je kalender" },
  { brand: "search_console", name: "Google Search Console", use: "Vindbaarheid in Google" },
  { brand: "google_ads", name: "Google Ads", use: "Campagneresultaten", soon: true },
];

export function IntegrationsStrip() {
  return (
    <section className="mkt-section-tight" id="integraties" aria-labelledby="int-title">
      <div className="mkt-container">
        <Reveal className="mkt-section-head">
          <span className="mkt-eyebrow">Integraties</span>
          <h2 className="mkt-h2" id="int-title">
            Koppel de tools die je al gebruikt.
          </h2>
          <p className="hs-lead">Je verbindt je accounts één keer met je werkruimte. Daarna werkt Mavix met je eigen reviews, berichten en agenda, zonder overtypen.</p>
        </Reveal>
        <Reveal>
          <ul className="int-grid">
          {integrations.map((it) => (
              <li className="int-tile" key={it.name}>
                <BrandIcon brand={it.brand} size={22} title={it.name} />
                <span>
                  <strong>{it.name}</strong>
                  <small>{it.use}</small>
                </span>
                {it.soon && <em>In ontwikkeling</em>}
              </li>
          ))}
          </ul>
        </Reveal>
        <p className="int-note">Een aantal koppelingen wacht nog op goedkeuring van Google of Meta. In Mavix zie je per koppeling precies wat al werkt.</p>
      </div>
    </section>
  );
}
