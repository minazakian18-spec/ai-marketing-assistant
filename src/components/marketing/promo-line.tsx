// One message about the start, the same everywhere on the site: Mavix is in a
// closed beta; taking part is free and starts with a request for access.
// Change PROMO_TEXT when paid plans open; nothing else needs to change.
const PROMO_TEXT = "Besloten beta: gratis meedoen. Vraag toegang aan.";

export function PromoLine() {
  if (!PROMO_TEXT) return null;
  return <p className="mkt-promo-line">{PROMO_TEXT}</p>;
}
