import { NextResponse, after } from "next/server";
import { workspace, failure, limited, sameOrigin, audit } from "@/lib/server/access";
import { researchState, runResearch, startResearch } from "@/lib/server/research";

// The workspace always comes from the signed-in session (never from the
// request body), so a client cannot run or read another workspace's research.

export async function GET() {
  try {
    const auth = await workspace();
    await limited("research-read:" + auth.user.id, 120);
    return NextResponse.json(await researchState(auth.workspaceId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return failure(e);
  }
}

// Start this month's research. The unique (workspace, month) row makes the
// limit hold on the server even if the button is clicked twice.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("research-start:" + auth.workspaceId, 5);
    const id = await startResearch(auth.workspaceId, auth.user.id);
    await audit(auth.workspaceId, auth.user.id, "research_started");
    after(() => runResearch(auth.workspaceId, id, auth.user.id));
    return NextResponse.json({ id }, { status: 202 });
  } catch (e) {
    return failure(e);
  }
}
