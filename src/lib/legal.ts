// Facts about the legal entity behind Mavix, used by every legal page.
// Fill these in once they are confirmed; until then the pages say plainly
// that the detail follows, instead of showing an invented value.
export const LEGAL = {
  /** Legal name of the company that operates Mavix. */
  entity: null as string | null,
  /** KvK (Chamber of Commerce) number. */
  kvk: null as string | null,
  /** Registered business address. */
  address: null as string | null,
  /** E-mail address for privacy questions and deletion requests. */
  privacyEmail: null as string | null,
  /** Date the texts were last changed (shown on every legal page). */
  updated: "20 oktober 2026",
};

export const LEGAL_PAGES = [
  { href: "/privacy", label: "Privacybeleid" },
  { href: "/voorwaarden", label: "Algemene voorwaarden" },
  { href: "/cookies", label: "Cookiebeleid" },
  { href: "/gegevens-verwijderen", label: "Gegevens verwijderen" },
] as const;
