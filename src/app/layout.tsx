import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { AppShell } from "@/components/app-shell";
import "./globals.css";
import "./account.css";
import "./brand.css";
import "./navigation.css";
import "./interactions.css";
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
    <html lang="nl">
      <body>
        <WorkspaceProvider>
          <AppShell>{children}</AppShell>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
