import Link from "next/link";
import { Check, AlertCircle, Mail, ArrowUpRight } from "lucide-react";
import {
  emailStats,
  emailReadiness,
  type EmailCampaign,
} from "@/lib/email-model";
import type { Profile } from "@/lib/types";
export function EmailStatus({ status }: { status: EmailCampaign["status"] }) {
  return (
    <span
      key={status}
      data-status={status}
      className={
        "badge " +
        (status === "blocked"
          ? "draft"
          : status === "sent"
            ? "approved"
            : status)
      }
    >
      {
        {
          draft: "Wacht op goedkeuring",
          approved: "Goedgekeurd",
          scheduled: "Ingepland",
          rejected: "Afgewezen",
          blocked: "Geblokkeerd",
          sent: "Demo verzonden",
        }[status]
      }
    </span>
  );
}
export function EmailPerformance() {
  return (
    <section className="panel email-performance">
      <div className="ig-card-head">
        <h2>
          <Mail size={17} />
          E-mail performance
        </h2>
        <span className="badge draft">Mockdata</span>
      </div>
      <dl>
        {emailStats.map(([label, value]) => (
          <div
            className={label === "Click rate" ? "highlight" : ""}
            key={label}
          >
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <Link className="text-link" href="/inzichten">
        Bekijk e-mail-inzichten <ArrowUpRight size={14} />
      </Link>
    </section>
  );
}
export function EmailReadiness({
  profile,
  campaigns,
}: {
  profile: Profile;
  campaigns: EmailCampaign[];
}) {
  const r = emailReadiness(profile, campaigns);
  return (
    <section className="panel ig-readiness">
      <div className="ig-card-head">
        <h2>Email readiness</h2>
        <strong>{r.score}%</strong>
      </div>
      <progress max={100} value={r.score} aria-label="Email readiness" />
      <ul>
        {r.checks.map((c) => (
          <li className={c.done ? "complete" : ""} key={c.label}>
            {c.done ? <Check size={15} /> : <AlertCircle size={15} />} {c.label}
          </li>
        ))}
      </ul>
      <Link className="button secondary full" href="/brand-hub">
        Verbeter Brand Hub
      </Link>
      <p className="field-note">
        Gebaseerd op jouw lokale merkgegevens en de gedeelde voorbeeldcontacten.
      </p>
    </section>
  );
}
