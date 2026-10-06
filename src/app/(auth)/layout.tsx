import type { Metadata } from "next";
import "../marketing.css";

// Account pages are reachable but not useful in search results.
export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: true },
};
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="mkt">{children}</div>;
}
