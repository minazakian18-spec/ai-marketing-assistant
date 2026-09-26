"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { pricingPlans, YEARLY_DISCOUNT_PERCENT } from "@/lib/pricing-data";

export function PricingCards() {
  const [yearly, setYearly] = useState(false);
  return (
    <div>
      <div className="mkt-billing-toggle">
        <span style={{ fontSize: 14, fontWeight: yearly ? 400 : 600 }}>
          Maandelijks
        </span>
        <button
          type="button"
          className="mkt-billing-switch"
          role="switch"
          aria-checked={yearly}
          aria-label="Wissel tussen maandelijkse en jaarlijkse facturering"
          onClick={() => setYearly(!yearly)}
        />
        <span style={{ fontSize: 14, fontWeight: yearly ? 600 : 400 }}>
          Jaarlijks
        </span>
        <span className="mkt-save-badge">Bespaar {YEARLY_DISCOUNT_PERCENT}%</span>
      </div>
      <div className="mkt-pricing-grid">
        {pricingPlans.map((plan) => {
          const price = yearly
            ? Math.round(
                (plan.monthlyPrice * (100 - YEARLY_DISCOUNT_PERCENT)) / 100,
              )
            : plan.monthlyPrice;
          return (
            <div
              key={plan.id}
              className={"mkt-price-card" + (plan.recommended ? " recommended" : "")}
            >
              {plan.recommended && (
                <span className="mkt-price-badge">Meest gekozen</span>
              )}
              <h3>{plan.name}</h3>
              <p className="mkt-plan-tagline">{plan.tagline}</p>
              <div className="mkt-price-amount">
                <strong>€{price}</strong>
                <span>/ maand{yearly ? ", jaarlijks gefactureerd" : ""}</span>
              </div>
              <p className="mkt-price-vat">Excl. btw · maandelijks opzegbaar</p>
              <ul>
                {plan.features.map((f) => (
                  <li key={f}>
                    <Check size={15} /> {f}
                  </li>
                ))}
                {plan.mutedFeatures?.map((f) => (
                  <li key={f} className="muted-feature">
                    <X size={15} /> {f}
                  </li>
                ))}
              </ul>
              <Link
                href={"/register?plan=" + plan.id}
                className={
                  "mkt-btn " +
                  (plan.recommended ? "mkt-btn-primary" : "mkt-btn-secondary")
                }
              >
                Kies {plan.name}
              </Link>
            </div>
          );
        })}
      </div>
      <div className="mkt-payment-icons">
        <span className="mkt-payment-icon">iDEAL</span>
        <span className="mkt-payment-icon">Creditcard</span>
        <span className="mkt-payment-icon">PayPal</span>
      </div>
    </div>
  );
}
