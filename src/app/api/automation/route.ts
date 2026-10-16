import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { automationStatus, setPermission } from "@/lib/server/automation";

const headers = { "Cache-Control": "private, no-store" };

// Per workflow: preference, explicit permission, requirements, approvals
// waiting, last run and failures (see lib/automation.ts).
export async function GET() {
  try {
    const auth = await workspace();
    return NextResponse.json({ workflows: await automationStatus(auth.workspaceId), role: auth.role }, { headers });
  } catch (e) {
    return failure(e);
  }
}

const input = z.object({ workflow: z.enum(["instagram_publish_scheduled", "email_send_scheduled", "review_auto_reply"]), enabled: z.boolean(), confirm: z.literal(true) });

// Give or withdraw permission for an automatic workflow (owners and admins,
// after an explicit confirmation in the UI).
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("automation:" + auth.user.id, 20);
    const { workflow, enabled } = input.parse(await request.json());
    await setPermission({ workspaceId: auth.workspaceId, userId: auth.user.id }, workflow, enabled);
    return NextResponse.json({ workflows: await automationStatus(auth.workspaceId) }, { headers });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Bevestig eerst deze wijziging."));
    return failure(e);
  }
}
