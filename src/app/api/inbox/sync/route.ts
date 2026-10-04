import { NextResponse } from "next/server";
import { workspace, failure, limited, sameOrigin } from "@/lib/server/access";
import { syncGmail } from "@/lib/server/inbox";

// Gmail polling sync (History API). Throttled per workspace; Instagram,
// Messenger and WhatsApp arrive through webhooks instead.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("inbox-sync:" + auth.workspaceId, 6);
    const result = await syncGmail(auth.workspaceId);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return failure(e);
  }
}
