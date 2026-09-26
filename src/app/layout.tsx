import type { Metadata } from "next";
import { Inter, Lexend } from "next/font/google";
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
export const metadata: Metadata = {
  title: "Mavix — Jouw AI-marketingteam in één werkruimte",
  icons: { icon: "/mavix-mark.svg", shortcut: "/mavix-mark.svg" },
  description:
    "Mavix beheert je Google-reviews, Instagram, e-mailmarketing en content vanuit één AI-werkruimte.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl" className={`${inter.variable} ${lexend.variable}`}>
      <body>{children}</body>
    </html>
  );
}
