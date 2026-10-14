import { NextResponse } from "next/server";
import { z } from "zod";
import { platformAdmin, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { actOnApplication, listApplications } from "@/lib/server/applications";

// Mavix staff only (public.platform_admins): review demo requests and account
// applications. Every change goes through the transition rules on the server;
// the browser cannot set a status directly.

export async function GET() {
  try {
    const { user } = await platformAdmin();
    await limited("admin:" + user.id, 60);
    return NextResponse.json({ applications: await listApplications() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return failure(e);
  }
}

const input = z.object({
  id: z.string().uuid(),
  action: z.enum(["complete_demo", "approve", "confirm_payment_manually", "waive_payment", "activate", "reject", "suspend", "reopen"]),
  note: z.string().trim().max(500).optional(),
  reason: z.string().trim().max(500).optional(),
});

export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const { user } = await platformAdmin();
    await limited("admin-write:" + user.id, 30);
    const body = input.parse(await request.json());
    return NextResponse.json(await actOnApplication(body.id, body.action, user.id, { note: body.note, reason: body.reason }));
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige aanvraag."));
    return failure(e);
  }
}
