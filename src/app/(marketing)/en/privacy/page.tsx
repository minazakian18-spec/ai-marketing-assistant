import type { Metadata } from "next";
import Link from "next/link";
import { Controller, LegalDocument, type LegalSection } from "@/components/marketing/legal-document";
import { LEGAL } from "@/lib/legal";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: "What data Mavix processes, why, with which services, and how Google user data is handled.",
  path: "/en/privacy",
});

// English version of /privacy. Keep the two in step.
const SCOPES: [string, string, string][] = [
  ["openid, email, profile", "Your name, email address and Google account ID", "Signing in and showing which Google account is connected."],
  ["business.manage", "Your Business Profile, its locations and the reviews on it", "Showing reviews and posting your replies. You approve every reply, or turn on automatic replies yourself."],
  ["calendar.events", "Events in your primary calendar", "Showing your marketing plan and adding the events you create in Mavix to your calendar."],
  ["webmasters.readonly", "Search performance of your website (clicks, impressions, queries)", "Showing how your website is found in Google. Read-only; we never change anything."],
  ["gmail.send", "Sending email only", "Sending emails and replies from your own address when you click Send. Mavix does not read, modify or delete your email."],
];

const sections: LegalSection[] = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <>
        <p>Mavix is AI marketing software for local businesses, operated by Webbo Solutions (sole proprietorship) in the Netherlands. For the data of your own account, Mavix is the controller. For data you process in Mavix about your customers (contacts, reviews, messages), you are the controller and Mavix processes it on your behalf.</p>
        <Controller lang="en" />
      </>
    ),
  },
  {
    id: "data",
    title: "What data we process",
    body: (
      <ul>
        <li>
          <strong>Account data:</strong> name, email address and sign-in data. Passwords are handled by Supabase Auth and never stored readable by Mavix.
        </li>
        <li>
          <strong>Workspace data:</strong> your Brand Hub, drafts, plans, campaigns, settings and the images in your Library.
        </li>
        <li>
          <strong>Customer data you manage:</strong> contacts and their newsletter consent, reviews from your Google Business Profile, Instagram messages in your Inbox, and emails you send through Mavix.
        </li>
        <li>
          <strong>Connections:</strong> encrypted access tokens and the permissions you grant to Google and Meta services.
        </li>
        <li>
          <strong>Technical data:</strong> server logs needed for security and debugging. We never log tokens, passwords or message content.
        </li>
      </ul>
    ),
  },
  {
    id: "google",
    title: "Google user data",
    body: (
      <>
        <p>You connect Google with one Google account. For each permission (scope) we use the data below, and nothing else:</p>
        <div className="lg-table-wrap">
          <table className="lg-table">
            <thead>
              <tr>
                <th scope="col">Scope</th>
                <th scope="col">Data</th>
                <th scope="col">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {SCOPES.map(([scope, data, purpose]) => (
                <tr key={scope}>
                  <td>
                    <code>{scope}</code>
                  </td>
                  <td>{data}</td>
                  <td>{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>We do not sell Google user data, do not use it for advertising, and do not use it to train generalised AI or machine-learning models. Humans at Mavix cannot read it, except with your permission for support, where the law requires it, or to investigate abuse.</p>
        <p>
          Mavix&apos;s use and transfer of information received from Google APIs to any other app will adhere to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements.
        </p>
      </>
    ),
  },
  {
    id: "ai",
    title: "AI",
    body: (
      <p>AI is only used for the feature you request, such as a review reply, a post or an email. Mavix sends OpenAI only what that request needs. AI output is always a draft: you decide what happens with it. Your data and Google user data are not used to train general AI models.</p>
    ),
  },
  {
    id: "storage",
    title: "Storage, security and retention",
    body: (
      <ul>
        <li>Data is stored with Supabase in the European Union (Ireland). Each workspace is isolated from every other workspace.</li>
        <li>Access tokens are encrypted with AES-256-GCM and never sent to the browser.</li>
        <li>When you disconnect a service, Mavix deletes its tokens immediately and, for Google, also revokes the access at Google.</li>
        <li>Reviews, calendar events and search data from Google are fetched when you view them and only kept while the connection is active.</li>
        <li>When you request deletion, we delete your workspace and its data within 30 days. Data we must keep by law, such as invoices, is kept for the legal period.</li>
      </ul>
    ),
  },
  {
    id: "rights",
    title: "Disconnecting and deleting your data",
    body: (
      <>
        <ul>
          <li>
            <strong>Disconnect:</strong> go to Account → Integrations and click Disconnect. You can also revoke access at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.
          </li>
          <li>
            <strong>Delete:</strong> email {LEGAL.privacyEmail} or follow the steps on <Link href="/gegevens-verwijderen">Gegevens verwijderen</Link> (data deletion).
          </li>
        </ul>
        <p>You have the right to access, correct, delete, restrict and port your data, and to object. You can complain to the Dutch Data Protection Authority (Autoriteit Persoonsgegevens).</p>
      </>
    ),
  },
];

export default function PrivacyEnPage() {
  return (
    <LegalDocument
      lang="en"
      title="Privacy Policy"
      current="/en/privacy"
      alternate="/privacy"
      intro="How Mavix handles the data of the businesses that use it and of their customers, including data received from Google APIs. The Dutch version is the primary text."
      sections={sections}
    />
  );
}
