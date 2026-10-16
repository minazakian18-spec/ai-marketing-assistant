import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, audit, HttpError } from "@/lib/server/access";
import { audience, campaignStats, sendCampaign, sendingCapability, sendTest } from "@/lib/server/email-campaigns";
import { segments } from "@/lib/contact-data";

const headers = { "Cache-Control": "private, no-store" };

// Pre-flight for one campaign: can Mavix send, how many consented recipients,
// how many contacts are left out for lack of consent, and delivery numbers.
export async function GET(request: Request) {
  try {
    const auth = await workspace();
    const url = new URL(request.url);
    const segment = url.searchParams.get("audience") || "Nieuwsbriefabonnees";
    if (!(segments as readonly string[]).includes(segment)) throw new HttpError(400, "Onbekende doelgroep.");
    const campaignId = url.searchParams.get("campaignId") || "";
    const capability = sendingCapability();
    const list = await audience(auth.workspaceId, segment).catch(() => null);
    const stats = /^[\w-]{1,80}$/.test(campaignId) ? await campaignStats(auth.workspaceId, campaignId).catch(() => null) : null;
    return NextResponse.json({ capability, recipients: list ? list.recipients.length : null, withoutConsent: list ? list.withoutConsent : null, stats }, { headers });
  } catch (e) {
    return failure(e);
  }
}

const input = z.object({ campaignId: z.string().min(1).max(80), mode: z.enum(["test", "send"]), confirm: z.literal(true) });

// Test e-mail (to yourself) or the real send. Owners and admins only; the
// browser must send confirm: true after the user confirmed in a dialog.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    const { campaignId, mode } = input.parse(await request.json());
    if (mode === "test") {
      await limited("email-test:" + auth.user.id, 5);
      return NextResponse.json(await sendTest({ workspaceId: auth.workspaceId, userId: auth.user.id, email: auth.user.email || "" }, campaignId), { headers });
    }
    await limited("email-send:" + auth.workspaceId, 5);
    const result = await sendCampaign({ workspaceId: auth.workspaceId, userId: auth.user.id, trigger: "manual" }, campaignId);
    if (!result.repeated) await audit(auth.workspaceId, auth.user.id, "email_campaign_sent").catch(() => {});
    return NextResponse.json(result, { headers });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Bevestig eerst wat je wilt versturen."));
    return failure(e);
  }
}
