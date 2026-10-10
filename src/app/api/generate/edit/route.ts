import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, sameOrigin, limited, failure, HttpError } from "@/lib/server/access";
import { CONTENT_EDITS, editContent, type ContentEdit } from "@/lib/server/ai";
import { metered } from "@/lib/server/ai-usage";
import { storedProfile } from "@/lib/server/stored-profile";

const input = z.object({
  action: z.enum(Object.keys(CONTENT_EDITS) as [ContentEdit, ...ContentEdit[]]),
  text: z.string().trim().min(5).max(6000),
  channel: z.enum(["instagram", "email"]),
});

// Content Studio quick actions (rewrite, shorter, longer, tone, clarity, CTA,
// alternatives) on the owner's current text. Returns suggestions only; the
// editor decides whether to replace its text.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("ai:" + auth.user.id, 10);
    await limited("ai-ws:" + auth.workspaceId, 60);
    const body = input.parse(await request.json());
    if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(503, "AI-bewerken is nog niet geconfigureerd. Je tekst is niet gewijzigd.");
    const profile = await storedProfile(auth.workspaceId);
    const results = await metered(auth, "content_edit", () => editContent(body.action, body.text, body.channel, profile), request.headers.get("idempotency-key"));
    return NextResponse.json({ results }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Er is nog geen tekst om te bewerken."));
    return failure(e);
  }
}
