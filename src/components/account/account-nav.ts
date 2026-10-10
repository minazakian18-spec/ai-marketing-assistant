import { Bell, Building2, CreditCard, Plug, ShieldCheck, Sparkles, UserRound, Users } from "lucide-react";

// Settings navigation, grouped. Every entry is an existing or new settings
// page; nothing is listed twice.
export const accountGroups = [
  {
    label: "Persoonlijk",
    links: [
      ["/account", "Account en profiel", "Naam, foto en contactgegevens", UserRound],
      ["/account/meldingen", "Meldingen", "Wat je wilt horen en waar", Bell],
      ["/account/privacy", "Beveiliging en privacy", "Wachtwoord, sessies en je gegevens", ShieldCheck],
    ],
  },
  {
    label: "Werkruimte",
    links: [
      ["/account/bedrijf", "Bedrijfsinstellingen", "Bedrijfsgegevens en adres", Building2],
      ["/account/team", "Team", "Collega's en werkruimtes", Users],
      ["/account/ai", "AI-voorkeuren", "Taal, toon en goedkeuring", Sparkles],
      ["/account/facturatie", "Abonnement en facturatie", "Plan, betalingen en facturen", CreditCard],
      ["/account/integraties", "Data en koppelingen", "Gekoppelde kanalen en diensten", Plug],
    ],
  },
] as const;

/** Flat list (used by the account menu). */
export const accountLinks = accountGroups.flatMap((g) => g.links.map(([href, label, , Icon]) => [href, label, Icon] as const));
