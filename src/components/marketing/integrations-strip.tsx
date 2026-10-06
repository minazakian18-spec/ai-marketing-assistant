import { BrandIcon, type Brand } from "@/components/brand-icon";
import { Reveal } from "./reveal";

const integrations: { brand: Brand; name: string }[] = [
  { brand: "google_business", name: "Google Bedrijfsprofiel" },
  { brand: "gmail", name: "Gmail" },
  { brand: "google_calendar", name: "Google Agenda" },
  { brand: "instagram", name: "Instagram" },
  { brand: "messenger", name: "Facebook Messenger" },
  { brand: "whatsapp", name: "WhatsApp Business" },
];

export function IntegrationsStrip() {
  return (
    <section className="mkt-section-tight" id="integraties">
      <div className="mkt-container">
        <Reveal className="mkt-section-head">
          <h2 className="mkt-h2">Koppel de tools die je al gebruikt.</h2>
        </Reveal>
        <div className="mkt-integrations-strip">
          {integrations.map((it, i) => (
            <Reveal delay={i * 50} key={it.name}>
              <div className="mkt-integration-chip">
                <BrandIcon brand={it.brand} size={17} title={it.name} />
                <span>{it.name}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
