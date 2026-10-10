import { NextResponse } from "next/server";
import { z } from "zod";
import { failure, HttpError, limited, sameOrigin, workspace } from "@/lib/server/access";
import { improveBrandText } from "@/lib/server/ai";
import { brandDraft } from "@/lib/server/brand-draft";
import { metered } from "@/lib/server/ai-usage";

const input = z.object({ field: z.enum(["description", "usps", "audience"]), text: z.string().max(2000), profile: brandDraft });

// "Verbeter met Mavi" in Brand Hub: a suggestion for the owner's own text.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("brand-ai:" + auth.user.id, 10);
    await limited("brand-ai-ws:" + auth.workspaceId, 40);
    const body = input.parse(await request.json());
    return NextResponse.json({ suggestion: await metered(auth, "brand_improve", () => improveBrandText(body.field, body.text, body.profile), request.headers.get("idempotency-key")) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Controleer je invoer."));
    return failure(e);
  }
}