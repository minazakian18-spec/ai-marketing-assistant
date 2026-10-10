import { NextResponse } from "next/server";
import { z } from "zod";
import { failure, HttpError, limited, sameOrigin, workspace } from "@/lib/server/access";
import { generateTonePreview } from "@/lib/server/ai";
import { brandDraft } from "@/lib/server/brand-draft";

// Live tone preview in Brand Hub: the current (unsaved) settings are sent so
// the owner hears the voice before saving. Example text only; nothing is
// stored or published.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("brand-ai:" + auth.user.id, 10);
    await limited("brand-ai-ws:" + auth.workspaceId, 40);
    const profile = brandDraft.parse(await request.json());
    return NextResponse.json(await generateTonePreview(profile), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Controleer je invoer."));
    return failure(e);
  }
}