import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, HttpError } from "@/lib/server/access";
import { listGoogleReviews } from "@/lib/server/google-business";

const query = z.object({
  pageToken: z.string().max(2000).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).default(25),
});

// Reviews of the workspace's selected Google location, newest activity first.
// Google stays the source of truth; nothing is stored in Mavix.
export async function GET(request: Request) {
  try {
    const auth = await workspace();
    await limited("reviews-list:" + auth.workspaceId, 60);
    const input = query.parse(Object.fromEntries(new URL(request.url).searchParams));
    return NextResponse.json(await listGoogleReviews(auth.workspaceId, input), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige pagina."));
    return failure(e);
  }
}
