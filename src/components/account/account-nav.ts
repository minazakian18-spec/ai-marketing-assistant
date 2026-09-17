import { UserRound, CreditCard, Plug, Bell, ShieldCheck } from "lucide-react";
export const accountLinks = [
  ["/account", "Mijn account", UserRound],
  ["/account/facturatie", "Facturatie", CreditCard],
  ["/account/integraties", "Integraties", Plug],
  ["/account/meldingen", "Meldingen", Bell],
  ["/account/privacy", "Privacy & data", ShieldCheck],
] as const;
