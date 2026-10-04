import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { sendReply } from "@/lib/server/inbox";
import { ALLOWED_UPLOADS } from "@/lib/inbox/core";

type Context = { params: Promise<{ id: string }> };

const input = z.object({
  clientId: z.string().uuid(),
  body: z.string().max(20000).default(""),
  attachments: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        mimeType: z.string().refine((t) => t in ALLOWED_UPLOADS),
        data: z.string().max(14_000_000).regex(/^[A-Za-z0-9+/=]*$/),
      }),
    )
    .max(5)
    .optional(),
  template: z
    .object({
      name: z.string().regex(/^[a-z0-9_]{1,512}$/),
      language: z.string().regex(/^[a-zA-Z_]{2,10}$/),
      variables: z.array(z.string().trim().min(1).max(1000)).max(20),
    })
    .optional(),
});

// Send a reply (idempotent per clientId; re-posting a failed clientId
// retries it). Always explicit: Mavi only drafts, a person sends.
export async function POST(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    if (Number(request.headers.get("content-length") || 0) > 22_000_000) throw new HttpError(413, "Bijlagen zijn te groot.");
    const auth = await workspace();
    await limited("inbox-send:" + auth.user.id, 30);
    await limited("inbox-send-ws:" + auth.workspaceId, 120);
    const { id } = await params;
    const result = await sendReply({ workspaceId: auth.workspaceId, userId: auth.user.id }, id, input.parse(await request.json()));
    return NextResponse.json(result, { status: result.status === "failed" ? 502 : 200 });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Controleer het bericht en de bijlagen."));
    return failure(e);
  }
}
