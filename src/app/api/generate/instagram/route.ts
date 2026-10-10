import { workspace, sameOrigin, limited, failure, HttpError } from "@/lib/server/access";
import { NextResponse } from "next/server";
import { generateContent, mockProviders } from "@/lib/providers/mock";
import type { GenerationRequest } from "@/lib/providers/contracts";
import { generateInstagramText } from "@/lib/server/ai";
import { metered } from "@/lib/server/ai-usage";
import { storedProfile } from "@/lib/server/stored-profile";
import { buildInstagramInstruction, goalLabel, isInstagramGoal } from "@/lib/ai/instagram-instruction";
import type { Profile } from "@/lib/types";

// Frontend -> Mavix backend -> Claude (server-side key). The Brand Hub
// profile is read from the database, never trusted from the browser. Images
// are the owner's own uploads; Mavix does not generate pictures. The local
// mock generator only runs in development with ENABLE_DEMO_AI=true and no key.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("ai:" + auth.user.id, 10);
    await limited("ai-ws:" + auth.workspaceId, 60);
    let body: GenerationRequest;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "Ongeldige aanvraag.");
    }
    if (!body?.prompt?.trim() || body.prompt.length > 2000) throw new HttpError(400, "Beschrijf in een paar woorden wat je wilt maken.");
    const profile = await storedProfile(auth.workspaceId);
    const req = { ...body, profile: profile as unknown as Profile, photos: Array.isArray(body.photos) ? body.photos.slice(0, 10) : [], variant: Number(body.variant) || 0 };
    if (!process.env.ANTHROPIC_API_KEY) {
      if (process.env.ENABLE_DEMO_AI === "true" && process.env.NODE_ENV !== "production") return NextResponse.json(await generateContent(req));
      throw new HttpError(503, "AI-generatie is nog niet geconfigureerd. Er is geen content gegenereerd.");
    }
    const goal = isInstagramGoal(req.goal || "") ? req.goal! : "merkbekendheid";
    const instruction = buildInstagramInstruction({ profile: req.profile, prompt: req.prompt, type: req.type, goal: goal as never, product: req.product, segmentId: req.segmentId, cta: req.cta, useWebsite: req.useWebsite });
    const post = await metered(
      auth,
      "content_instagram",
      () =>
        generateContent(req, {
          ...mockProviders,
          text: {
            generate: () =>
              generateInstagramText(
                {
                  type: req.type,
                  goal: goalLabel(instruction.goal),
                  instruction: req.prompt,
                  product: instruction.product ? { name: instruction.product.name, description: instruction.product.description } : req.product ? { name: req.product } : undefined,
                  audience: instruction.segment?.name,
                  cta: instruction.cta,
                  useDescription: !!req.useWebsite,
                  variant: req.variant,
                },
                profile,
              ),
          },
        }),
      request.headers.get("idempotency-key"),
    );
    return NextResponse.json(post, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return failure(e);
  }
}
