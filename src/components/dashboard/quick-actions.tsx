import Link from "next/link";
import { CalendarPlus, ChartNoAxesCombined, Instagram, Mail, MessageSquareReply } from "lucide-react";

const ACTIONS = [
  { href: "/social?tab=assist", label: "Instagram-post maken", detail: "Caption, hashtags en beeld", Icon: Instagram },
  { href: "/email?tab=assist", label: "E-mailcampagne maken", detail: "Nieuwsbrief of actie", Icon: Mail },
  { href: "/calendar", label: "Content plannen", detail: "Open de kalender", Icon: CalendarPlus },
  { href: "/reviews?tab=inbox", label: "Reviews beantwoorden", detail: "Reageer op klanten", Icon: MessageSquareReply },
  { href: "/inzichten", label: "Resultaten analyseren", detail: "Bekijk je inzichten", Icon: ChartNoAxesCombined },
];

export function QuickActions() {
  return (
    <section className="dash-quick" aria-labelledby="dash-quick-title">
      <h2 id="dash-quick-title" className="dash-section-title">
        Snelle acties
      </h2>
      <ul>
        {ACTIONS.map(({ href, label, detail, Icon }) => (
          <li key={href}>
            <Link href={href} className="dash-quick-item">
              <span className="dash-quick-icon">
                <Icon size={18} aria-hidden="true" />
              </span>
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
