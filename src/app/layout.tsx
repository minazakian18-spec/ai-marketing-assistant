import type { Metadata, Viewport } from "next";
import { Inter, Lexend } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME, pageMetadata, siteUrl } from "@/lib/site";
import "./globals.css";
import "./brand.css";
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
  display: "swap",
  weight: ["500", "600", "700"],
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
    <html lang="nl" className={`${inter.variable} ${lexend.variable}`} data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
