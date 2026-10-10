import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { getReport } from "@/lib/server/research";
import { researchAnswer } from "@/lib/server/ai";
import { metered } from "@/lib/server/ai-usage";
import { answerFromReport } from "@/lib/research/report";

type Context = { params: Promise<{ id: string }> };
const input = z.object({ question: z.string().trim().min(3).max(500) });

// Follow-up question about a report. Uses Claude with the report as the
// only context when AI is configured; otherwise answers from the report.
export async function POST(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("research-ask:" + auth.user.id, 20);
    const { id } = await params;
    const { question } = input.parse(await request.json());
    const row = await getReport(auth.workspaceId, id);
    const ai = process.env.ANTHROPIC_API_KEY ? await metered(auth, "research", () => researchAnswer(row.report!, question)).catch(() => null) : null;
    return NextResponse.json({ answer: ai || answerFromReport(question, row.report!), source: ai ? "ai" : "report" });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Stel een vraag van minimaal 3 tekens."));
    return failure(e);
  }
}
