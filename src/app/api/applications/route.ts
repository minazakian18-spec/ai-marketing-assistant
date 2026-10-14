import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { submitApplication } from "@/lib/server/applications";

// Public demo request / account application. Creates no account and grants
// no access: a platform administrator reviews every request. Validated,
// rate limited per e-mail and globally, with a honeypot field for bots.
// MAVIX_APPLICATIONS=closed turns submissions off.

const text = (max: number) => z.string().trim().max(max);
const optional = (max: number) => text(max).optional().transform((v) => v || undefined);
const input = z.object({
  kind: z.enum(["demo", "application"]),
  name: text(100).min(1),
  email: z.string().trim().toLowerCase().email().max(254),
  company: text(160).min(1),
  phone: optional(40),
  website: optional(300),
  industry: optional(100),
  plan: z.enum(["starter", "growth", "autopilot"]).optional(),
  message: optional(2000),
  preferredTime: optional(200),
  consent: z.literal(true),
  // Honeypot: real visitors never see or fill this field.
  fax: z.string().max(0).optional(),
});

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (process.env.MAVIX_APPLICATIONS === "closed") throw new HttpError(403, "Aanvragen is op dit moment gesloten. Probeer het later opnieuw.");
    const raw = await request.json().catch(() => ({}));
    if (typeof raw?.fax === "string" && raw.fax) return NextResponse.json({ ok: true }); // silently drop bots
    const body = input.parse(raw);
    const bucket = createHash("sha256").update(body.email).digest("hex").slice(0, 32);
    await limited("apply:" + bucket, 3);
    await limited("apply:global", 60);
    const { kind, consent: _consent, fax: _fax, ...fields } = body;
    void _consent;
    void _fax;
    await submitApplication({ kind, ...fields });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Controleer de velden. Naam, bedrijfsnaam, een geldig e-mailadres en je toestemming zijn verplicht."));
    return failure(e);
  }
}
