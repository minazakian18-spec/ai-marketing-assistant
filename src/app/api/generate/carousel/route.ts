import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, sameOrigin, limited, failure, HttpError } from "@/lib/server/access";
import { metered } from "@/lib/server/ai-usage";
import { aiConfigured } from "@/lib/server/openai";
import { generateCarouselPlan } from "@/lib/server/ai";
import { storedProfile } from "@/lib/server/stored-profile";
import { workspacePlan } from "@/lib/server/plan";
import { assertImageAccess } from "@/lib/server/image-input";

// Phase A of an Instagram carousel: one coherent plan (story, slide texts,
// image briefs, one shared visual style and one caption), metered as one
// "carousel" action (2 credits; Growth 4 and Premium 10 per month). The slide
// images are phase B: one /api/generate/image request per slide, each a
// separate metered AI image, so credits and the monthly image limit apply.
// Nothing is saved here.

const input = z.object({
  brief: z.string().trim().min(5).max(1000),
  goal: z.enum(["merkbekendheid", "verkoop", "reserveringen", "betrokkenheid", "informeren"]).default("merkbekendheid"),
  slides: z.number().int().min(2).max(10),
  product: z.string().trim().max(160).optional(),
  cta: z.string().trim().max(120).optional(),
  useBrand: z.boolean().default(true),
});

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    // Same closed test as single AI images: a carousel always needs AI images.
    assertImageAccess(auth.workspaceId);
    await limited("ai:" + auth.user.id, 10);
    await limited("ai-ws:" + auth.workspaceId, 60);
    const body = input.parse(await request.json());
    if (!aiConfigured()) throw new HttpError(503, "AI is nog niet geconfigureerd. Er is geen carrousel gemaakt.");
    const wp = await workspacePlan(auth.workspaceId);
    if (!wp.plan.entitlements.includes("carousels")) throw new HttpError(402, `AI-carrousels zitten niet in je ${wp.plan.name}-abonnement. Maak complete Instagram-carrousels met Mavix Growth.`);
    if (body.slides > wp.plan.carouselSlides) throw new HttpError(402, `Je ${wp.plan.name}-abonnement staat carrousels tot ${wp.plan.carouselSlides} slides toe.`);
    const profile = body.useBrand ? await storedProfile(auth.workspaceId) : null;
    const plan = await metered(auth, "carousel_plan", () => generateCarouselPlan({ brief: body.brief, goal: body.goal, count: body.slides, product: body.product, cta: body.cta }, profile), request.headers.get("idempotency-key"));
    return NextResponse.json({ plan }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Beschrijf je carrousel in een paar woorden en kies 2 tot 10 slides."));
    return failure(e);
  }
}
