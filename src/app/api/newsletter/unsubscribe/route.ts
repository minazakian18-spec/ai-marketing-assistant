import { NextResponse } from "next/server";
import { limited } from "@/lib/server/access";
import { appUrl } from "@/lib/server/supabase";
import { evidenceFrom, ipHash, unsubscribe, verifyUnsubscribeToken } from "@/lib/server/newsletter";

// Unsubscribe. Two ways in:
// - the confirmation page /nieuwsbrief/afmelden posts the form field "token";
// - RFC 8058 one-click (List-Unsubscribe-Post): POST ?token=… with the body
//   "List-Unsubscribe=One-Click", answered with 200.
// The token is a MAC over the subscriber id; it never expires.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const evidence = evidenceFrom(request);
  try {
    await limited("newsletter-unsub:" + (ipHash(evidence.ip) || "unknown"), 30);
    const form = await request.formData().catch(() => null);
    const oneClick = form?.get("List-Unsubscribe") === "One-Click";
    const token = String(url.searchParams.get("token") || form?.get("token") || "");
    const id = verifyUnsubscribeToken(token);
    const done = id ? await unsubscribe(id, oneClick ? "one_click" : "link", evidence) : false;
    if (oneClick) return new Response(null, { status: done ? 200 : 400 });
    return NextResponse.redirect(new URL("/nieuwsbrief/status?s=" + (done ? "unsubscribed" : "invalid_link"), appUrl()), 303);
  } catch (e) {
    console.error(JSON.stringify({ event: "newsletter_unsubscribe_failed", code: (e as { code?: string })?.code || "error" }));
    return NextResponse.redirect(new URL("/nieuwsbrief/status?s=error", appUrl()), 303);
  }
}
