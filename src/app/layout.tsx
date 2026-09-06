import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { AppShell } from "@/components/app-shell";
import "./globals.css";
export const metadata: Metadata = {
  title: "Marketing AI — Jouw contentwerkruimte",
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
