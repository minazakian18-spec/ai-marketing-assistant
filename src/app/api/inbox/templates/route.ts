import { NextResponse } from "next/server";
import { workspace, failure, limited } from "@/lib/server/access";
import { whatsappTemplates } from "@/lib/server/meta";

// Approved WhatsApp message templates (for replies outside the 24h window).
export async function GET() {
  try {
    const auth = await workspace();
    await limited("inbox-templates:" + auth.user.id, 20);
    return NextResponse.json({ templates: await whatsappTemplates(auth.workspaceId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return failure(e);
  }
}
