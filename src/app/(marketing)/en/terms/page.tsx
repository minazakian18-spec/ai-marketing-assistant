import type { Metadata } from "next";
import Link from "next/link";
import { Controller, LegalDocument, type LegalSection } from "@/components/marketing/legal-document";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Service",
  description: "The terms for using Mavix during the closed beta and after.",
  path: "/en/terms",
});

// Short English version of /voorwaarden. The Dutch text prevails.
const sections: LegalSection[] = [
  {
    id: "scope",
    title: "Scope",
    body: (
      <>
        <p>
          These terms apply to the use of Mavix, its website and software. By creating an account or using Mavix you accept these terms and the <Link href="/en/privacy">Privacy Policy</Link>. Mavix is meant for businesses, not consumers.
        </p>
        <Controller lang="en" />
      </>
    ),
  },
  {
    id: "beta",
    title: "Closed beta",
    body: <p>Mavix is in closed beta. Features can change, and access is granted per workspace after personal approval.</p>,
  },
  {
    id: "ai",
    title: "AI-generated content",
    body: <p>Mavix uses AI to draft texts, images and suggestions. AI can make mistakes; always review content before you use it. Mavix publishes or sends nothing without your action or a setting you turned on yourself.</p>,
  },
  {
    id: "connections",
    title: "Connections with other platforms",
    body: (
      <ul>
        <li>You connect your own Google, Meta and other accounts. They remain yours, and you can disconnect them at any time in Mavix or at the platform.</li>
        <li>
          Mavix uses data from Google services only for the features you use in Mavix, as described in the <Link href="/en/privacy#google">Privacy Policy</Link>. It is not sold, not used for advertising and not used to train general AI models.
        </li>
        <li>Mavix depends on those platforms; when they change their rules or access, a feature may work less well.</li>
      </ul>
    ),
  },
  {
    id: "content",
    title: "Your content",
    body: <p>What you put into Mavix and create with it remains yours. You only give Mavix the permission needed to provide the service.</p>,
  },
  {
    id: "law",
    title: "Applicable law",
    body: <p>Dutch law applies. If the English and Dutch texts differ, the Dutch text (<Link href="/voorwaarden">Algemene voorwaarden</Link>) prevails.</p>,
  },
];

export default function TermsEnPage() {
  return <LegalDocument lang="en" title="Terms of Service" current="/en/terms" alternate="/voorwaarden" intro="The agreement for using Mavix." sections={sections} />;
}
