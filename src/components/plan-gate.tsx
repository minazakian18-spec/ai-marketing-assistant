"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { isBrowserDemo } from "@/lib/demo";
import { PLAN_IDS, PLANS, type Entitlement } from "@/lib/plans";

// Display-only plan check (the server enforces the same on every route).
type PlanInfo = { state: string; planId: string | null; name: string; entitlements: Entitlement[]; inspirationMax: number; carouselSlides: number; imageLimit: number | null };
let cached: Promise<PlanInfo | null> | null = null;

export function usePlan() {
  const [plan, setPlan] = useState<PlanInfo | null | undefined>(undefined);
  useEffect(() => {
    if (isBrowserDemo()) return setPlan(null);
    cached ??= fetch("/api/plan", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    let live = true;
    void cached.then((p) => live && setPlan(p));
    return () => {
      live = false;
    };
  }, []);
  return plan;
}

/** A calm explanation instead of a feature the plan does not include, with the cheapest plan that does. */
export function UpgradeNotice({ entitlement, feature, children, title }: { entitlement: Entitlement; feature: string; children?: React.ReactNode; title?: string }) {
  const up = PLAN_IDS.map((id) => PLANS[id]).find((p) => p.entitlements.includes(entitlement));
  return (
    <section className="upgrade-notice" role="note">
      <span className="upgrade-notice-icon" aria-hidden="true">
        <Lock size={18} />
      </span>
      <div>
        <strong>{title || `${feature} zit niet in je huidige pakket`}</strong>
        <p>{children || (up ? `${feature} is beschikbaar vanaf ${up.name}. Je bestaande gegevens en content blijven gewoon beschikbaar.` : "")}</p>
        <div className="upgrade-notice-actions">
          <Link href="/account/facturatie" className="button primary">
            {up ? `Bekijk ${up.name}` : "Abonnement bekijken"}
          </Link>
          <Link href="/pricing#vergelijk" className="button secondary">
            Pakketten vergelijken
          </Link>
        </div>
      </div>
    </section>
  );
}
