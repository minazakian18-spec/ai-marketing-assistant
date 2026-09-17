import Link from "next/link";
import { Check, AlertCircle, ArrowUpRight } from "lucide-react";
import type { Profile } from "@/lib/types";
import { readiness } from "@/lib/instagram-model";
export function BrandReadiness({ profile }: { profile: Profile }) {
  const { score, checks } = readiness(profile);
  return (
    <section className="panel ig-readiness">
      <div className="ig-card-head">
        <div>
          <h2>Brand readiness</h2>
          <p>Je eigen Brand Hub als bron.</p>
        </div>
        <strong>{score}%</strong>
      </div>
      <progress
        value={score}
        max={100}
        aria-label={"Brand readiness " + score + "%"}
      />
      <ul>
        {checks.map((c) => (
          <li key={c.label} className={c.done ? "complete" : ""}>
            {c.done ? <Check size={15} /> : <AlertCircle size={15} />}
            <span>
              {c.label}
              {!c.done && " ontbreekt"}
            </span>
          </li>
        ))}
      </ul>
      <Link className="text-link" href="/brand-hub">
        Verbeter Brand Hub
        <ArrowUpRight size={15} />
      </Link>
    </section>
  );
}
