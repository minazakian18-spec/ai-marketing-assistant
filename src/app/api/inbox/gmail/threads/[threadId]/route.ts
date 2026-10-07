import { NextResponse } from "next/server";
import { workspace, limited, failure } from "@/lib/server/access";
import { getGmailThread } from "@/lib/server/gmail";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const auth = await workspace();
    await limited("gmail-detail:" + auth.workspaceId, 60);
    const { threadId } = await params;
    return NextResponse.json(
      { thread: await getGmailThread(auth.workspaceId, threadId) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
