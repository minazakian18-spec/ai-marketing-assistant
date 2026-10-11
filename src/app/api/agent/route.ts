import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { adminClient } from "@/lib/server/supabase";
import { agentReply } from "@/lib/server/ai";
import { metered } from "@/lib/server/ai-usage";
import { aiConfigured } from "@/lib/server/openai";
import { readiness } from "@/lib/instagram-model";
import type { Profile } from "@/lib/types";
import { emptyWorkspace } from "@/lib/storage";

const input = z.object({
  text: z.string().trim().min(1).max(1500),
  history: z.array(z.object({ role: z.enum(["user", "agent"]), text: z.string().max(4000) })).max(20).default([]),
});

// Mavix Agent on OpenAI. The business context is read on the server from the
// caller's own workspace (never from the browser), so a conversation can only
// ever see that workspace. Conversations are not stored; the history comes
// from the open session. Answers are text only: the agent performs no actions.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("agent:" + auth.user.id, 10);
    await limited("agent-ws:" + auth.workspaceId, 60);
    const body = input.parse(await request.json());
    if (!aiConfigured()) return NextResponse.json({ configured: false }, { headers: { "Cache-Control": "private, no-store" } });
    const db = adminClient();
    const [{ data: bp, error }, { data: conns }] = await Promise.all([
      db.from("business_profiles").select("data").eq("workspace_id", auth.workspaceId).maybeSingle(),
      db.from("integration_connections").select("provider,status").eq("workspace_id", auth.workspaceId),
    ]);
    if (error) throw new HttpError(503, "Je werkruimte kon niet worden geladen.");
    const w = (bp?.data || {}) as { profile?: Record<string, unknown>; posts?: { status: string; date?: string }[]; email?: { campaigns?: { status: string }[] } };
    const posts = w.posts || [];
    const campaigns = w.email?.campaigns || [];
    const state = {
      brand_hub_complete_percent: readiness({ ...emptyWorkspace.profile, ...(w.profile || {}) } as Profile).score,
      drafts_waiting_for_approval: posts.filter((p) => p.status === "draft").length + campaigns.filter((c) => c.status === "draft").length,
      scheduled_posts: posts.filter((p) => p.status === "scheduled").length,
      scheduled_emails: campaigns.filter((c) => c.status === "scheduled").length,
      connected_integrations: (conns || []).filter((c) => c.status === "connected").map((c) => c.provider),
      current_page: request.headers.get("x-mavix-page")?.slice(0, 80) || undefined,
    };
    const reply = await metered(auth, "agent", () => agentReply(w.profile || {}, state, body.history, body.text), request.headers.get("idempotency-key"));
    return NextResponse.json({ configured: true, ...reply }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Stel een vraag van maximaal 1500 tekens."));
    return failure(e);
  }
}
