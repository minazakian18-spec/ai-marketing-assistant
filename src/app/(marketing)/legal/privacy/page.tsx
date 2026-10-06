import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
// Not indexed until the final legal text is published (placeholder now).
export const metadata: Metadata = {
  title: "Privacybeleid",
  robots: { index: false, follow: true },
  alternates: { canonical: "/legal/privacy" },
};
export default function Page() {
  return (
    <LegalPage
      title="Privacybeleid"
      intro="Hier komt te staan welke gegevens Mavix verzamelt, waarom, en hoe je controle houdt over je gegevens."
    />
  );
}
