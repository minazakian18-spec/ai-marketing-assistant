import { redirect } from "next/navigation";
import { authClient } from "@/lib/server/supabase";

// /integraties is a short link people type or share. Signed in: the
// Integraties page in the app; otherwise the integrations section of the site.
export const dynamic = "force-dynamic";

export default async function IntegratiesRedirect() {
  let signedIn = false;
  try {
    const { data } = await (await authClient()).auth.getUser();
    signedIn = !!data.user;
  } catch {
    signedIn = false;
  }
  redirect(signedIn ? "/account/integraties" : "/#integraties");
}
