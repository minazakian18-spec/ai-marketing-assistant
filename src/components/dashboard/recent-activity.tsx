import Link from "next/link";
import { History, Instagram, Mail } from "lucide-react";
import { Badge, Card, EmptyState, SectionHeader } from "@/components/ui";
import { relativeTime, type Activity } from "@/lib/dashboard-data";

// Real workspace activity only. With nothing yet, an honest empty state.
export function RecentActivity({ items }: { items: Activity[] }) {
  return (
    <Card className="dash-card">
      <SectionHeader title="Recente activiteit" icon={<History size={16} />} />
      {items.length ? (
        <ul className="dash-list">
          {items.map((a) => (
            <li key={a.id}>
              <Link href={a.href} className="dash-row">
                <span className="dash-row-icon">
                  {a.channel === "E-mail" ? <Mail size={16} aria-hidden="true" /> : <Instagram size={16} aria-hidden="true" />}
                </span>
                <span className="dash-row-main">
                  <strong>{a.title}</strong>
                  <small>
                    {a.channel} · <time dateTime={a.at}>{relativeTime(a.at)}</time>
                  </small>
                </span>
                <Badge tone={a.tone}>{a.label}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<History size={18} />} title="Nog geen activiteit">
          Zodra je content maakt, goedkeurt of inplant, zie je dat hier.
        </EmptyState>
      )}
    </Card>
  );
}
