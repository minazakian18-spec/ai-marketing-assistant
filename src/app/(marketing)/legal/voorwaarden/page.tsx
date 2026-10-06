import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
// Not indexed until the final legal text is published (placeholder now).
export const metadata: Metadata = {
  title: "Algemene voorwaarden",
  robots: { index: false, follow: true },
  alternates: { canonical: "/legal/voorwaarden" },
};
export default function Page() {
  return (
    <LegalPage
      title="Algemene voorwaarden"
      intro="Hier komen de algemene voorwaarden voor het gebruik van Mavix te staan."
    />
  );
}
