import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { Reveal } from "./reveal";

// Businesses that really work with Mavix. Only list real partners who agreed
// to be shown: this strip is social proof, so no example or invented brands.
// `plate` is the background behind a logo drawn in white on transparency.
type Partner = { name: string; place: string; logo: string; plate?: string };

const PARTNERS: Partner[] = [
  { name: "Telepizza", place: "Amstelveen", logo: "/partners/telepizza-amstelveen.webp", plate: "#1d1530" },
];

// From this many partners on, the row becomes a slow, endless marquee.
const MARQUEE_FROM = 4;

function PartnerCard({ partner }: { partner: Partner }) {
  return (
    <li className="mkt-partner">
      <span className="mkt-partner-logo" style={partner.plate ? { background: partner.plate } : undefined}>
        <Image src={partner.logo} alt={`Logo van ${partner.name} ${partner.place}`} width={160} height={160} unoptimized />
      </span>
      <span className="mkt-partner-text">
        <strong>{partner.name}</strong>
        <small>{partner.place}</small>
      </span>
    </li>
  );
}

export function PartnersStrip() {
  const marquee = PARTNERS.length >= MARQUEE_FROM;
  return (
    <section className="mkt-partners" aria-labelledby="mkt-partners-title">
      <div className="mkt-container">
        <Reveal className="mkt-partners-head">
          <h2 id="mkt-partners-title">Samen met ondernemers gebouwd</h2>
          <p>Lokale bedrijven die Mavix dagelijks gebruiken en mee vormgeven.</p>
        </Reveal>
        {marquee ? (
          <div className="mkt-partners-marquee">
            <ul className="mkt-partners-track">
              {[...PARTNERS, ...PARTNERS].map((p, i) => (
                <PartnerCard key={p.name + i} partner={p} />
              ))}
            </ul>
          </div>
        ) : (
          <Reveal delay={80}>
            <ul className="mkt-partners-row">
              {PARTNERS.map((p) => (
                <PartnerCard key={p.name} partner={p} />
              ))}
              <li className="mkt-partner mkt-partner-invite">
                <Link href="/aanvragen">
                  <span className="mkt-partner-logo">
                    <Plus size={20} aria-hidden="true" />
                  </span>
                  <span className="mkt-partner-text">
                    <strong>Jouw zaak?</strong>
                    <small>Bouw mee als beta-partner</small>
                  </span>
                </Link>
              </li>
            </ul>
          </Reveal>
        )}
      </div>
    </section>
  );
}
