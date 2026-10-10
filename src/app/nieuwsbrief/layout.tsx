import type { Metadata } from "next";
import "./newsletter.css";

// Public newsletter pages (hosted signup form, confirmation, unsubscribe):
// no account needed, never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function NewsletterLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="nl-page">
      <div className="nl-card">{children}</div>
      <p className="nl-foot">Aanmelding verwerkt door Mavix</p>
    </main>
  );
}
