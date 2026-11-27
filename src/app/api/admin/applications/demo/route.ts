import { NextResponse } from "next/server";
import { z } from "zod";
import { platformAdmin, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { adminClient } from "@/lib/server/supabase";

// Mavix staff only: plan (or clear) the demo moment of a demo request, with a
// short note (e.g. video link or address). Does not change the status; the
// demo is marked as held with the normal "complete_demo" action.
const input = z.object({
  id: z.string().uuid(),
  demoAt: z.string().datetime({ offset: true }).nullable(),
  demoNote: z.string().trim().max(1000).optional(),
});

export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const { user } = await platformAdmin();
    await limited("admin-write:" + user.id, 30);
    const body = input.parse(await request.json());
    const db = adminClient();
    const { data, error } = await db
      .from("account_applications")
      .update({ demo_scheduled_at: body.demoAt, demo_note: body.demoNote ?? null })
      .eq("id", body.id)
      .select("id")
      .maybeSingle();
    if (error) throw new HttpError(503, "De demo kon niet worden opgeslagen. Is de database bijgewerkt?");
    if (!data) throw new HttpError(404, "Aanvraag niet gevonden.");
    await db.from("account_application_events").insert({ application_id: body.id, from_status: null, to_status: "demo_scheduled", note: body.demoAt ? "Demo gepland" : "Demo-afspraak verwijderd", actor_id: user.id }).then(
      () => null,
      () => null,
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige aanvraag."));
    return failure(e);
  }
}
