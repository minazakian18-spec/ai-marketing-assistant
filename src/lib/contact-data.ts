import type { Contact } from "./types";

export function sampleContacts(): Contact[] {
  const base = new Date("2026-01-15T09:00:00").toISOString();
  return [
    {
      id: "contact-sample-1",
      firstName: "Sanne",
      lastName: "de Vries",
      email: "sanne@example.test",
      group: "Nieuwsbrieflezers",
      status: "Ingeschreven",
      source: "sample",
      createdAt: base,
    },
    {
      id: "contact-sample-2",
      firstName: "Daan",
      lastName: "Bakker",
      email: "daan@example.test",
      group: "Vaste klanten",
      status: "Ingeschreven",
      source: "sample",
      createdAt: base,
    },
    {
      id: "contact-sample-3",
      firstName: "Noor",
      lastName: "Jansen",
      email: "noor@example.test",
      group: "Nieuwsbrieflezers",
      status: "Niet bevestigd",
      source: "sample",
      createdAt: base,
    },
    {
      id: "contact-sample-4",
      firstName: "Milan",
      lastName: "Visser",
      email: "milan@example.test",
      group: "Vaste klanten",
      status: "Uitgeschreven",
      source: "sample",
      createdAt: base,
    },
  ];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function contactValid(c: Record<string, unknown>): boolean {
  return !!(
    c &&
    ["id", "firstName", "lastName", "email", "createdAt"].every(
      (k) => typeof c[k] === "string",
    ) &&
    EMAIL_RE.test(String(c.email)) &&
    ["Ingeschreven", "Niet bevestigd", "Uitgeschreven"].includes(
      String(c.status),
    ) &&
    ["manual", "import", "sample"].includes(String(c.source)) &&
    (c.phone === undefined || typeof c.phone === "string") &&
    (c.company === undefined || typeof c.company === "string") &&
    (c.group === undefined || typeof c.group === "string")
  );
}

export function contactName(c: Contact) {
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || c.email;
}

export function distinctGroups(contacts: Contact[]) {
  return [...new Set(contacts.map((c) => c.group).filter(Boolean))] as string[];
}

// Legacy autopilot targeting segments. These names are validated against
// persisted workspaces (see email-model.ts), so the list itself must stay
// stable; only the underlying contact data behind `recipients()` is live.
export const segments = [
  "Alle contacten",
  "Nieuwe klanten",
  "VIP klanten",
  "Inactief 60+ dagen",
  "Recente kopers",
  "Nieuwsbriefabonnees",
] as const;
export type Segment = (typeof segments)[number];

// `recipients`/`emailReadiness` etc. are called from many places (autopilot
// targeting, campaign previews, simulation) that only know a segment name,
// not the current workspace. Rather than threading the live contact list
// through every one of those call sites, WorkspaceProvider keeps this module
// in sync with the real, persisted contacts via `syncContacts`. Falls back to
// the sample set so code (and tests) that never renders the app still behaves
// exactly like the previous static mock data.
let liveContacts: Contact[] = sampleContacts();
export function syncContacts(contacts: Contact[]) {
  liveContacts = contacts;
}
export function allContacts() {
  return liveContacts;
}
const groupToSegment: Record<string, Segment> = {
  Nieuw: "Nieuwe klanten",
  "Vaste klanten": "VIP klanten",
  Inactief: "Inactief 60+ dagen",
  Klant: "Recente kopers",
  Nieuwsbrieflezers: "Nieuwsbriefabonnees",
};
export function segmentForGroup(group?: string): Segment {
  if (!group) return "Alle contacten";
  if (groupToSegment[group]) return groupToSegment[group];
  if ((segments as readonly string[]).includes(group)) return group as Segment;
  return "Alle contacten";
}

export function recipients(segment: string) {
  return liveContacts.filter(
    (c) =>
      c.status === "Ingeschreven" &&
      (segment === "Alle contacten" ||
        (segment === "Nieuwe klanten" && c.group === "Nieuw") ||
        (segment === "VIP klanten" && c.group === "Vaste klanten") ||
        (segment === "Inactief 60+ dagen" && c.group === "Inactief") ||
        (segment === "Recente kopers" && c.group === "Klant") ||
        (segment === "Nieuwsbriefabonnees" &&
          c.group === "Nieuwsbrieflezers") ||
        c.group === segment),
  );
}
