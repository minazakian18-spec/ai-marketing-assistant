import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { syncWorkspace } from "@/lib/server/calendar";

// Incremental Google sync (sync tokens, skipped when push says nothing changed),
// push channel renewal and Mavix content mirroring.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("calendar-sync:" + auth.user.id, 20);
    const { calendars } = z
      .object({ calendars: z.array(z.string().min(1).max(1024)).max(20) })
      .parse(await request.json());
    const result = await syncWorkspace(
      { workspaceId: auth.workspaceId, userId: auth.user.id },
      calendars,
    );
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige aanvraag."));
    return failure(e);
  }
}
