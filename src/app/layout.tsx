import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME, pageMetadata, siteUrl } from "@/lib/site";
import "./globals.css";
import "./brand.css";
import "./typography.css";
// One typeface for the whole product. Inter's optical-size axis gives large
// headings its display cut automatically (font-optical-sizing: auto), so no
// second display font is loaded. next/font self-hosts it with a size-adjusted
// fallback, so text does not shift when the font arrives.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  axes: ["opsz"],
});

// Defaults for every page. Icons come from the app/ file conventions
// (favicon.ico, icon.svg, apple-icon.png) and the web manifest.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  ...pageMetadata({ title: "Mavix — AI-marketingsoftware voor ondernemers", description: SITE_DESCRIPTION, path: "/", absoluteTitle: true }),
  title: { default: "Mavix — AI-marketingsoftware voor ondernemers", template: "%s | Mavix" },
  alternates: undefined,
  applicationName: SITE_NAME,
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#6d28d9",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl" className={inter.variable} data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
