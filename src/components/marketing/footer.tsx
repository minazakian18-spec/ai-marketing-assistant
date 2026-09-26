import Link from "next/link";
import { Brand } from "@/components/brand";

const columns = [
  {
    title: "Product",
    links: [
      ["/#product", "Overzicht"],
      ["/#oplossingen", "Oplossingen"],
      ["/#integraties", "Integraties"],
      ["/pricing", "Prijzen"],
    ],
  },
  {
    title: "Bedrijf",
    links: [
      ["/#resources", "Resources"],
      ["/login", "Inloggen"],
      ["/register", "Gratis starten"],
    ],
  },
  {
    title: "Support",
    links: [
      ["/#faq", "Veelgestelde vragen"],
      ["/pricing", "Facturatie & prijzen"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["/legal/privacy", "Privacybeleid"],
      ["/legal/voorwaarden", "Algemene voorwaarden"],
      ["/legal/cookies", "Cookiebeleid"],
      ["/legal/avg", "Gegevensverwerking (AVG)"],
    ],
  },
] as const;

export function MarketingFooter() {
  return (
    <footer className="mkt-footer">
      <div className="mkt-container">
        <div className="mkt-footer-grid">
          <div className="mkt-footer-brand">
            <Brand />
            <p>Eén AI-werkruimte voor reviews, Instagram, e-mail en content.</p>
          </div>
          {columns.map((col) => (
            <div className="mkt-footer-col" key={col.title}>
              <h4>{col.title}</h4>
              {col.links.map(([href, label]) => (
                <Link key={href} href={href}>
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="mkt-footer-bottom">
          <span>© {new Date().getFullYear()} Mavix. Alle rechten voorbehouden.</span>
          <div className="mkt-footer-legal">
            <Link href="/legal/privacy">Privacy</Link>
            <Link href="/legal/voorwaarden">Voorwaarden</Link>
            <Link href="/legal/cookies">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
