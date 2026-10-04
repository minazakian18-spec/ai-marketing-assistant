import { NextResponse } from "next/server";
import { workspace, failure, limited } from "@/lib/server/access";
import { calendarStatus, listCalendars } from "@/lib/server/calendar";

// Connection status, mirror settings and (when connected) the user's calendars.
export async function GET() {
  try {
    const auth = await workspace();
    await limited("calendar:" + auth.user.id, 120);
    const status = await calendarStatus(auth.workspaceId, auth.user.id);
    const calendars =
      status.status === "connected" && "mine" in status && status.mine
        ? await listCalendars({ workspaceId: auth.workspaceId, userId: auth.user.id })
        : [];
    return NextResponse.json(
      { ...status, calendars },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
