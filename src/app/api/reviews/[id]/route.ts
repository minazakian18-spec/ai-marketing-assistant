import { NextResponse } from "next/server";
import { workspace, failure, limited } from "@/lib/server/access";
import { getGoogleReview } from "@/lib/server/google-business";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const auth = await workspace();
    await limited("reviews-detail:" + auth.workspaceId, 60);
    const { id } = await params;
    return NextResponse.json({ review: await getGoogleReview(auth.workspaceId, id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return failure(e);
  }
}
