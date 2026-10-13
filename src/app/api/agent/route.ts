import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { agentReply } from "@/lib/server/agent/agent";
import { metered } from "@/lib/server/ai-usage";
import { aiConfigured, modelFor } from "@/lib/server/openai";
import { addMessage, createConversation, getConversation, listMessages, workspaceContext, type Owner } from "@/lib/server/agent-store";
import { titleFrom } from "@/lib/agent/capabilities";

const input = z.union([
  z.object({ text: z.string().trim().min(1).max(1500), conversationId: z.string().uuid().optional() }),
  z.object({ retry: z.literal(true), conversationId: z.string().uuid() }),
]);
const headers = { "Cache-Control": "private, no-store" };

// Send a message to Mavix Agent. The conversation is created on the first
// message (never for an empty "New chat"). History and business context are
// read on the server from the caller's own workspace and conversation; the
// browser only sends the new text. Every AI call goes through metered()
// (beta access, quotas, reservation-first budget, concurrency, ledger).
// Without AI configuration nothing is stored, so the draft stays with the user.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("agent:" + auth.user.id, 10);
    await limited("agent-ws:" + auth.workspaceId, 60);
    const body = input.parse(await request.json());
    if (!aiConfigured()) return NextResponse.json({ configured: false }, { headers });
    const owner: Owner = { workspaceId: auth.workspaceId, userId: auth.user.id };

    let conversation = body.conversationId ? await getConversation(owner, body.conversationId) : null;
    let question: string;
    let userMessage = null;
    if ("retry" in body) {
      // Retry the last question; only allowed when its answer failed or is missing.
      const { messages } = await listMessages(owner, conversation!.id);
      const last = messages[messages.length - 1];
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      if (!lastUser || (last && last.role === "assistant" && last.status === "ok")) throw new HttpError(409, "Er is geen mislukte vraag om opnieuw te proberen.");
      question = lastUser.content;
    } else {
      question = body.text;
      conversation ??= await createConversation(owner, titleFrom(body.text));
      userMessage = await addMessage(owner, conversation.id, { role: "user", content: body.text });
    }

    const { messages } = await listMessages(owner, conversation!.id);
    const history = messages
      .filter((m) => m.status === "ok")
      .slice(0, -1) // the question itself is passed separately
      .slice(-8)
      .map((m) => ({ role: m.role === "user" ? ("user" as const) : ("agent" as const), text: m.content }));
    const ctx = await workspaceContext(auth.workspaceId);

    try {
      const reply = await metered(auth, "agent", () => agentReply({ workspaceId: auth.workspaceId, userId: auth.user.id, role: auth.role }, ctx.profile, ctx.state, history, question), request.headers.get("idempotency-key"));
      const saved = await addMessage(owner, conversation!.id, { role: "assistant", content: reply.text, model: modelFor("advanced"), action: reply.action || null });
      return NextResponse.json({ configured: true, conversation: await getConversation(owner, conversation!.id), userMessage, reply: saved }, { headers });
    } catch (e) {
      // The failure is kept in the conversation (user-safe text only) so the
      // user sees what happened after a reload and can retry.
      const message = e instanceof HttpError ? e.message : "Mavi kon geen antwoord geven. Probeer het opnieuw.";
      const status = e instanceof HttpError ? e.status : 503;
      const saved = await addMessage(owner, conversation!.id, { role: "assistant", content: message, status: "failed" });
      return NextResponse.json({ configured: true, conversation: await getConversation(owner, conversation!.id), userMessage, reply: saved, error: message }, { status, headers });
    }
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Stel een vraag van maximaal 1500 tekens."));
    return failure(e);
  }
}

// Whether AI answers are available (no secrets, no usage data).
export async function GET() {
  try {
    await workspace();
    return NextResponse.json({ configured: aiConfigured() }, { headers });
  } catch (e) {
    return failure(e);
  }
}
