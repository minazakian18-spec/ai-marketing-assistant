// The real "eerste maand gratis bij jaarlijkse abonnementen" offer isn't
// backed by billing yet (no Stripe price/coupon wired to it) — showing it
// would be a false production claim. This line is intentionally a safe,
// true statement instead. Swap PROMO_TEXT to the real offer once billing
// supports it; nothing else needs to change.
const PROMO_TEXT = "Geen creditcard nodig om te starten";

export function PromoLine() {
  if (!PROMO_TEXT) return null;
  return <p className="mkt-promo-line">{PROMO_TEXT}</p>;
}
