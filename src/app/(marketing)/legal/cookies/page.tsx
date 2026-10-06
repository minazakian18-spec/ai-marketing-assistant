import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
// Not indexed until the final legal text is published (placeholder now).
export const metadata: Metadata = {
  title: "Cookiebeleid",
  robots: { index: false, follow: true },
  alternates: { canonical: "/legal/cookies" },
};
export default function Page() {
  return (
    <LegalPage
      title="Cookiebeleid"
      intro="Hier komt te staan welke cookies Mavix gebruikt en hoe je je voorkeuren kunt beheren."
    />
  );
}
