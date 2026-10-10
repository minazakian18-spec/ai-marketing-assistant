import { NextResponse } from "next/server";
import { limited } from "@/lib/server/access";
import { appUrl } from "@/lib/server/supabase";
import { confirm, evidenceFrom, ipHash } from "@/lib/server/newsletter";

// Double opt-in confirmation. The e-mail links to /nieuwsbrief/bevestigen,
// which posts here: link scanners that only open (GET) the link do not
// confirm anything.
export async function POST(request: Request) {
  const go = (s: string) => NextResponse.redirect(new URL("/nieuwsbrief/status?s=" + s, appUrl()), 303);
  try {
    const evidence = evidenceFrom(request);
    await limited("newsletter-confirm:" + (ipHash(evidence.ip) || "unknown"), 20);
    const token = String((await request.formData()).get("token") || "");
    return go((await confirm(token, evidence)) ? "confirmed" : "expired");
  } catch (e) {
    console.error(JSON.stringify({ event: "newsletter_confirm_failed", code: (e as { code?: string })?.code || "error" }));
    return go("error");
  }
}
