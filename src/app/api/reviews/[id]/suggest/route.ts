import { NextResponse } from "next/server";
import { workspace, failure, limited, sameOrigin } from "@/lib/server/access";
import { adminClient } from "@/lib/server/supabase";
import { getGoogleReview } from "@/lib/server/google-business";
import { generateReviewReply } from "@/lib/server/ai";

type Context = { params: Promise<{ id: string }> };

// "Voorstel van Mavi": a draft only. The review is read from Google on the
// server (never from the browser) and nothing is posted.
export async function POST(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("reviews-ai:" + auth.user.id, 10);
    await limited("reviews-ai-ws:" + auth.workspaceId, 40);
    const { id } = await params;
    const review = await getGoogleReview(auth.workspaceId, id);
    const { data } = await adminClient().from("business_profiles").select("data").eq("workspace_id", auth.workspaceId).maybeSingle();
    const workspaceData = (data?.data || {}) as { profile?: Record<string, unknown>; review?: { settings?: { tone?: string; signature?: string } } };
    const text = await generateReviewReply(
      { reviewer: review.reviewer.anonymous ? "" : review.reviewer.name, rating: review.rating, comment: review.comment },
      workspaceData.profile || {},
      workspaceData.review?.settings || {},
    );
    return NextResponse.json({ text: text.slice(0, 4096) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return failure(e);
  }
}
