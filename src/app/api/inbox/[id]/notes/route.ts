import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { addNote } from "@/lib/server/inbox";

type Context = { params: Promise<{ id: string }> };
const input = z.object({ clientId: z.string().uuid(), body: z.string().trim().min(1).max(5000) });

// Internal note: visible to the team only, never sent to the customer.
export async function POST(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("inbox-note:" + auth.user.id, 30);
    const { id } = await params;
    const body = input.parse(await request.json());
    return NextResponse.json(await addNote({ workspaceId: auth.workspaceId, userId: auth.user.id }, id, body.body, body.clientId));
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Schrijf eerst een notitie."));
    return failure(e);
  }
}
