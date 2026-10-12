import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { createFolder } from "@/lib/server/agent-store";

const input = z.object({ name: z.string().trim().min(1).max(60) });

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("agent-edit:" + auth.user.id, 60);
    const { name } = input.parse(await request.json());
    return NextResponse.json({ folder: await createFolder({ workspaceId: auth.workspaceId, userId: auth.user.id }, name) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Geef de map een naam van maximaal 60 tekens."));
    return failure(e);
  }
}
