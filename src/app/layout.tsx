import type { Metadata } from "next";
import { Inter, Lexend } from "next/font/google";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { AppShell } from "@/components/app-shell";
import "./globals.css";
import "./account.css";
import "./brand.css";
import "./navigation.css";
import "./interactions.css";
import "./review.css";
import "./library.css";
import "./contacts.css";
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
  title: "Mavix — Jouw contentwerkruimte",
  icons: { icon: "/mavix-mark.svg", shortcut: "/mavix-mark.svg" },
  description:
    "Maak, bewerk en plan je marketingcontent in één lokale werkruimte.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl" className={`${inter.variable} ${lexend.variable}`}>
      <body>
        <WorkspaceProvider>
          <AppShell>{children}</AppShell>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
