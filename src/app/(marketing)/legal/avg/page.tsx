import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
// Not indexed until the final legal text is published (placeholder now).
export const metadata: Metadata = {
  title: "Gegevensverwerking (AVG)",
  robots: { index: false, follow: true },
  alternates: { canonical: "/legal/avg" },
};
export default function Page() {
  return (
    <LegalPage
      title="Gegevensverwerking (AVG)"
      intro="Hier komt informatie te staan over hoe Mavix persoonsgegevens verwerkt onder de AVG/GDPR, inclusief een verwerkersovereenkomst."
    />
  );
}
