import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { decideAction } from "@/lib/server/agent/actions";
import { addMessage, setProposalStatus } from "@/lib/server/agent-store";
import { adminClient } from "@/lib/server/supabase";

type Context = { params: Promise<{ id: string }> };
const input = z.object({ decision: z.enum(["confirm", "cancel"]) });
const headers = { "Cache-Control": "private, no-store" };

// Confirm or cancel a change Mavix Agent proposed. This is the only place an
// agent proposal changes the workspace; see lib/server/agent/actions.ts for
// the rules (own action only, OWNER/ADMIN, once, expiry, audit).
export async function POST(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("agent-action:" + auth.user.id, 30);
    const { decision } = input.parse(await request.json());
    const owner = { workspaceId: auth.workspaceId, userId: auth.user.id };
    const { action, repeated } = await decideAction({ ...owner, role: auth.role }, (await params).id, decision);
    let message = null;
    if (!repeated) {
      const { data: row } = await adminClient().from("agent_actions").select("conversation_id,message_id").eq("id", action.id).eq("workspace_id", auth.workspaceId).eq("user_id", auth.user.id).maybeSingle();
      if (row?.message_id) await setProposalStatus(owner, row.message_id as string, { id: action.id, summary: action.summary, status: action.status, href: action.result?.href });
      // An honest note in the conversation of what happened.
      if (row?.conversation_id && action.status === "done" && action.result?.href)
        message = await addMessage(owner, row.conversation_id as string, {
          role: "assistant",
          content: "De campagne is opgeslagen als concepten in Content Studio. Er is niets ingepland, gepubliceerd of verstuurd.",
          action: { href: action.result.href, label: "Open campagne" },
        }).catch(() => null);
    }
    return NextResponse.json({ action, message }, { headers });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige keuze."));
    return failure(e);
  }
}
