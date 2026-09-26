import { workspace, sameOrigin, limited, failure } from "@/lib/server/access";
import { NextResponse } from "next/server";
import { generateEmail } from "@/lib/providers/email-mock";
import type { EmailRequest } from "@/lib/providers/email-mock";

// Same "Frontend -> Backend -> AI Service" architecture as
// /api/generate/instagram. See that route's comment for context.
export async function POST(request: Request) {
  try { sameOrigin(request); const auth = await workspace(); await limited("ai:"+auth.user.id,10); } catch(error) { return failure(error); }
  if(process.env.ENABLE_DEMO_AI !== "true" || process.env.NODE_ENV === "production") return NextResponse.json({error:"AI-generatie is nog niet geconfigureerd. Er is geen content gegenereerd."},{status:503});
  let body: EmailRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  if (!body?.prompt?.trim() || !body.profile) {
    return NextResponse.json(
      { error: "Prompt en bedrijfsprofiel zijn verplicht." },
      { status: 400 },
    );
  }
  try {
    const campaign = await generateEmail(body);
    return NextResponse.json(campaign);
  } catch {
    return NextResponse.json(
      { error: "Genereren is niet gelukt. Probeer opnieuw." },
      { status: 500 },
    );
  }
}
