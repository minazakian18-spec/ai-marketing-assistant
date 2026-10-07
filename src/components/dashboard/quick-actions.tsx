import Link from "next/link";
import { ArrowUpRight, CalendarPlus, ChartNoAxesCombined, Instagram, Mail, MessageSquareReply } from "lucide-react";

// Tool shortcuts. `tone` picks a calm icon tint (see .qa-tone-* in polish.css).
const ACTIONS = [
  { href: "/social?tab=assist", group: "Maken", label: "Instagram-post maken", detail: "Caption, hashtags en beeldconcept in één keer.", Icon: Instagram, tone: "rose" },
  { href: "/email?tab=assist", group: "Maken", label: "E-mailcampagne maken", detail: "Een nieuwsbrief of actie, klaar om in te plannen.", Icon: Mail, tone: "blue" },
  { href: "/calendar", group: "Plannen", label: "Content plannen", detail: "Zet je week klaar in de kalender.", Icon: CalendarPlus, tone: "violet" },
  { href: "/reviews?tab=inbox", group: "Opvolgen", label: "Reviews beantwoorden", detail: "Reageer snel en persoonlijk op klanten.", Icon: MessageSquareReply, tone: "amber" },
  { href: "/inzichten", group: "Analyseren", label: "Resultaten bekijken", detail: "Zie wat werkt en waar winst zit.", Icon: ChartNoAxesCombined, tone: "green" },
] as const;

export function QuickActions() {
  return (
    <section className="dash-quick" aria-labelledby="dash-quick-title">
      <div className="dash-heading">
        <h2 id="dash-quick-title" className="dash-section-title">
          Snelle acties
        </h2>
        <p>Direct aan de slag, zonder te zoeken.</p>
      </div>
      <ul>
        {ACTIONS.map(({ href, group, label, detail, Icon, tone }, i) => (
          <li key={href} style={{ ["--i" as string]: i }}>
            <Link href={href} className="dash-quick-item">
              <span className={"dash-quick-icon qa-tone-" + tone}>
                <Icon size={18} aria-hidden="true" />
              </span>
              <ArrowUpRight className="dash-quick-arrow" size={16} aria-hidden="true" />
              <span className="dash-quick-text">
                <em>{group}</em>
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
