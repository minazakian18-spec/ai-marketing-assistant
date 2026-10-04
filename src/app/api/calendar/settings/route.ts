import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, HttpError, audit } from "@/lib/server/access";
import { calendarStatus, saveSettings } from "@/lib/server/calendar";

export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("calendar:" + auth.user.id, 30);
    const settings = z
      .object({ mirror: z.boolean(), mirrorCalendarId: z.string().min(1).max(1024) })
      .parse(await request.json());
    const status = await calendarStatus(auth.workspaceId, auth.user.id);
    if (status.status === "disconnected" || !("mine" in status) || !status.mine)
      throw new HttpError(403, "Alleen wie Google Calendar heeft gekoppeld kan dit wijzigen.");
    await saveSettings(auth.workspaceId, settings);
    await audit(auth.workspaceId, auth.user.id, "calendar_settings_changed");
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige instellingen."));
    return failure(e);
  }
}
