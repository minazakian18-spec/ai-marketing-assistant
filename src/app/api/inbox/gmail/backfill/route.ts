import { NextResponse } from "next/server";
import { workspace, sameOrigin, limited, failure } from "@/lib/server/access";
import { backfillGmail } from "@/lib/server/inbox";

// "Meer laden": import the next page of older Gmail conversations into the
// workspace Inbox (Gmail nextPageToken). One page per request, rate limited.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("gmail-backfill:" + auth.workspaceId, 10);
    return NextResponse.json(await backfillGmail(auth.workspaceId), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
