import { workspace, sameOrigin, limited, failure, HttpError } from "@/lib/server/access";
import { NextResponse } from "next/server";
import { generateEmail, type EmailRequest } from "@/lib/providers/email-mock";
import { generateEmailText } from "@/lib/server/ai";
import { metered } from "@/lib/server/ai-usage";
import { storedProfile } from "@/lib/server/stored-profile";
import type { Profile } from "@/lib/types";

// Same architecture as /api/generate/instagram: Claude on the server, the
// stored Brand Hub profile as context, a draft as result. Nothing is sent.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("ai:" + auth.user.id, 10);
    await limited("ai-ws:" + auth.workspaceId, 60);
    let body: EmailRequest;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "Ongeldige aanvraag.");
    }
    if (!body?.prompt?.trim() || body.prompt.length > 2000) throw new HttpError(400, "Beschrijf in een paar woorden waar de e-mail over gaat.");
    const profile = await storedProfile(auth.workspaceId);
    const req: EmailRequest = { ...body, profile: profile as unknown as Profile, variant: Number(body.variant) || 0 };
    if (!process.env.ANTHROPIC_API_KEY) {
      if (process.env.ENABLE_DEMO_AI === "true" && process.env.NODE_ENV !== "production") return NextResponse.json(await generateEmail(req));
      throw new HttpError(503, "AI-generatie is nog niet geconfigureerd. Er is geen content gegenereerd.");
    }
    const campaign = await metered(
      auth,
      "content_email",
      () =>
        generateEmail(req, {
          generate: () =>
            generateEmailText(
              {
                kind: req.kind,
                instruction: req.prompt,
                audience: req.audience,
                product: req.product,
                offer: req.offer,
                tone: req.tone,
                length: req.length,
                cta: req.cta,
                useDescription: !!req.useWebsite,
                variant: req.variant,
              },
              profile,
            ),
        }),
      request.headers.get("idempotency-key"),
    );
    return NextResponse.json(campaign, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return failure(e);
  }
}
