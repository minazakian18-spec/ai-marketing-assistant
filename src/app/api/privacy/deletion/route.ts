import { NextResponse } from "next/server";
import { workspace, sameOrigin, failure, limited, audit } from "@/lib/server/access";

// Request deletion of the account and personal data. Recorded in the audit
// log (event name only), which Mavix administrators see in Beheer; the
// administrator verifies the request and carries it out. Nothing is deleted
// automatically here, so a mistaken click cannot destroy data.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("deletion:" + auth.user.id, 3);
    await audit(auth.workspaceId, auth.user.id, "data_deletion_requested");
    console.info(JSON.stringify({ event: "data_deletion_requested" }));
    return NextResponse.json(
      { ok: true, message: "Je verwijderverzoek is ontvangen. We bevestigen het binnen één maand via het e-mailadres van je account en laten weten wanneer het is uitgevoerd." },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
