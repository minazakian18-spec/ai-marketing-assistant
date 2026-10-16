import type { Contact } from "./types";

// Smart segments in Contacts, built only from fields Mavix actually stores
// (consent records, status, source, phone, name). No guessing about people.

export type Consent = "proven" | "stated" | "pending" | "none";

/**
 * Marketing consent as Mavix can prove it:
 *   proven  = newsletter signup through a Mavix form (recorded evidence);
 *   stated  = marked "Ingeschreven" by the user (import or by hand) without a
 *             signup record; campaigns via Mavix do NOT go to these contacts;
 *   pending = signup not confirmed yet / "Niet bevestigd";
 *   none    = unsubscribed.
 */
export function consentOf(c: Contact): Consent {
  if (c.newsletter?.status === "unsubscribed" || c.status === "Uitgeschreven") return "none";
  if (c.newsletter?.status === "subscribed") return "proven";
  if (c.newsletter?.status === "pending" || c.status === "Niet bevestigd") return "pending";
  return "stated";
}

export const CONSENT_LABEL: Record<Consent, string> = {
  proven: "Aantoonbaar ingeschreven via formulier",
  stated: "Door jou als ingeschreven gemarkeerd; ontvangt geen campagnes via Mavix",
  pending: "Nog niet bevestigd",
  none: "Uitgeschreven",
};

export const SMART_SEGMENTS: { id: string; label: string; test: (c: Contact) => boolean }[] = [
  { id: "smart:proven", label: "Kan campagnes ontvangen", test: (c) => consentOf(c) === "proven" },
  { id: "smart:stated", label: "Toestemming niet aantoonbaar", test: (c) => consentOf(c) === "stated" },
  { id: "smart:none", label: "Uitgeschreven", test: (c) => consentOf(c) === "none" },
  { id: "smart:import", label: "Uit import", test: (c) => c.source === "import" },
  { id: "smart:phone", label: "Met telefoonnummer", test: (c) => !!c.phone?.trim() },
  { id: "smart:noname", label: "Zonder naam", test: (c) => !c.firstName.trim() && !c.lastName.trim() },
];

/** Fills empty fields of an existing contact from an import row; never touches consent, status or source. */
export function mergeInto(existing: Contact, row: Partial<Pick<Contact, "firstName" | "lastName" | "phone" | "company" | "group">>) {
  const changed: string[] = [];
  const next = { ...existing };
  for (const k of ["firstName", "lastName", "phone", "company", "group"] as const) {
    const v = (row[k] || "").trim();
    if (v && !(existing[k] || "").trim()) {
      next[k] = v;
      changed.push(k);
    }
  }
  return { contact: next, changed };
}
