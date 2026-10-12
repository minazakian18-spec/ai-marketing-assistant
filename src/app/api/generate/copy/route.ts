import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, sameOrigin, limited, failure, HttpError } from "@/lib/server/access";
import { generateMarketingCopy } from "@/lib/server/ai";
import { metered } from "@/lib/server/ai-usage";
import { aiConfigured } from "@/lib/server/openai";
import { storedProfile } from "@/lib/server/stored-profile";

const input = z.object({
  kind: z.enum(["website", "advertentie", "flyer", "productomschrijving", "overig"]),
  prompt: z.string().trim().min(3).max(1500),
});

// Marketing copy for Content Studio: OpenAI on the server, the stored Brand
// Hub as context, metered like every AI feature. Returns text only.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("ai:" + auth.user.id, 10);
    await limited("ai-ws:" + auth.workspaceId, 60);
    const body = input.parse(await request.json());
    if (!aiConfigured()) throw new HttpError(503, "AI-generatie is nog niet geconfigureerd. Er is geen tekst gemaakt.");
    const profile = await storedProfile(auth.workspaceId);
    const text = await metered(auth, "content_copy", () => generateMarketingCopy(body.kind, body.prompt, profile), request.headers.get("idempotency-key"));
    return NextResponse.json({ text: text.slice(0, 20000) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Beschrijf in een paar woorden welke tekst je nodig hebt."));
    return failure(e);
  }
}
