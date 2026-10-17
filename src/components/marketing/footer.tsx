import Link from "next/link";
import { Brand } from "@/components/brand";

const columns = [
  {
    title: "Product",
    links: [
      ["/#product", "Producten"],
      ["/#hoe-het-werkt", "Hoe het werkt"],
      ["/#functies", "Functies"],
      ["/#integraties", "Integraties"],
      ["/pricing", "Prijzen"],
    ],
  },
  {
    title: "Bedrijf",
    links: [
      ["/login", "Inloggen"],
      ["/demo", "Demo aanvragen"],
      ["/aanvragen", "Account aanvragen"],
    ],
  },
  {
    title: "Support",
    links: [
      ["/#faq", "Veelgestelde vragen"],
      ["/pricing#faq", "Vragen over abonnementen"],
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
              <h2>{col.title}</h2>
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
