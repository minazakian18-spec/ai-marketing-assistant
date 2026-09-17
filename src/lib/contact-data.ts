export const contacts = [
  {
    name: "Sanne de Vries",
    email: "sanne@example.test",
    group: "Nieuwsbrieflezers",
    tag: "Interesse",
    status: "Ingeschreven",
  },
  {
    name: "Daan Bakker",
    email: "daan@example.test",
    group: "Vaste klanten",
    tag: "Klant",
    status: "Ingeschreven",
  },
  {
    name: "Noor Jansen",
    email: "noor@example.test",
    group: "Nieuwsbrieflezers",
    tag: "Nieuw",
    status: "Niet bevestigd",
  },
  {
    name: "Milan Visser",
    email: "milan@example.test",
    group: "Vaste klanten",
    tag: "Klant",
    status: "Uitgeschreven",
  },
];

export const segments = [
  "Alle contacten",
  "Nieuwe klanten",
  "VIP klanten",
  "Inactief 60+ dagen",
  "Recente kopers",
  "Nieuwsbriefabonnees",
] as const;
export type Segment = (typeof segments)[number];
export function recipients(segment: string) {
  return contacts.filter(
    (c) =>
      c.status === "Ingeschreven" &&
      (segment === "Alle contacten" ||
        (segment === "Nieuwe klanten" && c.tag === "Nieuw") ||
        (segment === "VIP klanten" && c.group === "Vaste klanten") ||
        (segment === "Inactief 60+ dagen" && c.tag === "Inactief") ||
        (segment === "Recente kopers" && c.tag === "Klant") ||
        (segment === "Nieuwsbriefabonnees" && c.group === "Nieuwsbrieflezers")),
  );
}
