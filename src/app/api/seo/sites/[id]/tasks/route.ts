import { NextResponse } from "next/server";
import { z } from "zod";
import { failure, HttpError, limited, sameOrigin, workspace } from "@/lib/server/access";
import { listTasks, setTask, TASK_STATUSES } from "@/lib/server/seo";
import { CHECKS } from "@/lib/seo/checks";

// SEO action plan statuses for one website of the caller's workspace. Every
// member may track progress; the website must belong to the workspace
// (siteRow). A status is the team's own note and never marks a problem as
// fixed: only a new analysis can show that.

type Context = { params: Promise<{ id: string }> };
const CHECK_IDS = new Set(CHECKS.map((c) => c.id));
const input = z.object({ checkId: z.string().max(60), status: z.enum(TASK_STATUSES) }).strict();

export async function GET(_request: Request, { params }: Context) {
  try {
    const auth = await workspace();
    return NextResponse.json(await listTasks(auth.workspaceId, (await params).id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return failure(e);
  }
}

export async function PUT(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("seo-task:" + auth.user.id, 60);
    const body = input.parse(await request.json());
    if (!CHECK_IDS.has(body.checkId)) throw new HttpError(400, "Onbekend actiepunt.");
    return NextResponse.json(await setTask(auth.workspaceId, (await params).id, body.checkId, body.status, auth.user.id));
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige status."));
    return failure(e);
  }
}
