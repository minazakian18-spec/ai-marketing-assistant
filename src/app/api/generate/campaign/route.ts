import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, sameOrigin, limited, failure, HttpError } from "@/lib/server/access";
import { generateCampaign } from "@/lib/server/ai";
import { metered } from "@/lib/server/ai-usage";
import { aiConfigured } from "@/lib/server/openai";
import { storedProfile } from "@/lib/server/stored-profile";

const input = z.object({
  goal: z.string().trim().min(5).max(1000),
  channels: z.array(z.enum(["instagram", "email", "copy"])).min(1).max(3),
});

// A multi-channel campaign draft for Content Studio: one AI call (metered as
// content_campaign) with the stored Brand Hub as context. Returns drafts only;
// the browser saves what the owner keeps. Regenerating one item is the same
// call with a single channel, so other items are never replaced.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("ai:" + auth.user.id, 10);
    await limited("ai-ws:" + auth.workspaceId, 60);
    const body = input.parse(await request.json());
    if (!aiConfigured()) throw new HttpError(503, "AI-generatie is nog niet geconfigureerd. Er is geen campagne gemaakt.");
    const profile = await storedProfile(auth.workspaceId);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());
    const draft = await metered(auth, "content_campaign", () => generateCampaign(body.goal, [...new Set(body.channels)], profile, today), request.headers.get("idempotency-key"));
    return NextResponse.json({ draft, today }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Beschrijf je doel in minstens een paar woorden en kies minstens één kanaal."));
    return failure(e);
  }
}
