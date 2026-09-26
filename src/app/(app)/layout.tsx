export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { authClient, configured } from "@/lib/server/supabase";
import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { AppShell } from "@/components/app-shell";
import "../account.css";
import "../navigation.css";
import "../interactions.css";
import "../review.css";
import "../library.css";
import "../contacts.css";
export const metadata: Metadata = {
  title: "Mavix — Jouw werkruimte",
  description: "Maak, bewerk en plan je marketingcontent in je Mavix-werkruimte.",
};
export default async function AppGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!configured()) redirect("/login?setup=required");
  const db = await authClient();
  const {data: {user}} = await db.auth.getUser();
  if (!user) redirect("/login?session=expired");
  return (
    <WorkspaceProvider>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
