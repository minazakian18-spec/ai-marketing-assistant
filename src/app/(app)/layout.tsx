export const dynamic = "force-dynamic";
import { cookies } from "next/headers";
import { DEMO_COOKIE, demoSession } from "@/lib/demo";
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
import "../workspace.css";
export const metadata: Metadata = {
  title: "Mavix — Jouw werkruimte",
  description:
    "Maak, bewerk en plan je marketingcontent in je Mavix-werkruimte.",
};
export default async function AppGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const demo = demoSession(
    (await cookies()).get(DEMO_COOKIE)?.value,
    process.env.NODE_ENV,
  );
  if (!demo) {
    if (!configured()) redirect("/login?setup=required");
    const db = await authClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) redirect("/login?session=expired");
  }
  return (
    <WorkspaceProvider demo={demo}>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
