import { workspace, sameOrigin, limited, failure } from "@/lib/server/access";
import { NextResponse } from "next/server";
import { generateContent } from "@/lib/providers/mock";
import type { GenerationRequest } from "@/lib/providers/contracts";

// Frontend -> Mavix Backend -> AI Service -> (future) AI Provider API.
// Today the AI Service still runs the local mock generator (see
// src/lib/providers/mock.ts); no external request is made and no API key is
// read. Swapping in a real provider later only changes that file — this
// route, and the client that calls it, do not need to change.
export async function POST(request: Request) {
  try { sameOrigin(request); const auth = await workspace(); await limited("ai:"+auth.user.id,10); } catch(error) { return failure(error); }
  if(process.env.ENABLE_DEMO_AI !== "true" || process.env.NODE_ENV === "production") return NextResponse.json({error:"AI-generatie is nog niet geconfigureerd. Er is geen content gegenereerd."},{status:503});
  let body: GenerationRequest;
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
    const post = await generateContent(body);
    return NextResponse.json(post);
  } catch {
    return NextResponse.json(
      { error: "Genereren is niet gelukt. Probeer opnieuw." },
      { status: 500 },
    );
  }
}
