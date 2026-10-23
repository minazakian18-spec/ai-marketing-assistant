import type { Metadata } from "next";

// Browser-tab name; the page itself is a client component.
export const metadata: Metadata = { title: "SEO Intelligence" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
