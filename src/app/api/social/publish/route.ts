import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, audit, HttpError } from "@/lib/server/access";
import { publishCapability, publishPost, recentPublications } from "@/lib/server/instagram-publish";

const headers = { "Cache-Control": "private, no-store" };
const input = z.object({ postId: z.string().min(1).max(80), confirm: z.literal(true) });

// Whether this workspace can publish to Instagram, and the latest attempts.
export async function GET() {
  try {
    const auth = await workspace();
    const [capability, recent] = await Promise.all([publishCapability(auth.workspaceId), recentPublications(auth.workspaceId)]);
    return NextResponse.json({ capability, recent }, { headers });
  } catch (e) {
    return failure(e);
  }
}

// Publish one approved post to Instagram now. The browser must send
// confirm: true (the user confirmed in a dialog); owners and admins only.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("ig-publish:" + auth.workspaceId, 10);
    const { postId } = input.parse(await request.json());
    const result = await publishPost({ workspaceId: auth.workspaceId, userId: auth.user.id, trigger: "manual" }, postId);
    if (!result.repeated) await audit(auth.workspaceId, auth.user.id, "instagram_published").catch(() => {});
    return NextResponse.json(result, { headers });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Bevestig eerst dat je deze post wilt publiceren."));
    return failure(e);
  }
}
