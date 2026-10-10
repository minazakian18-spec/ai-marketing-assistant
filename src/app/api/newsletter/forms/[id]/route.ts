import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, failure, HttpError, sameOrigin, workspace } from "@/lib/server/access";
import { adminClient } from "@/lib/server/supabase";
import { FORM_COLUMNS } from "@/lib/server/newsletter";
import { checkDoubleOptIn, formInput, toRow } from "@/lib/server/newsletter-forms";

type Context = { params: Promise<{ id: string }> };
const formId = (id: string) => {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, "Formulier niet gevonden.");
  return id;
};

export async function PATCH(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    const id = formId((await params).id);
    const input = formInput.parse(await request.json());
    checkDoubleOptIn(input);
    const { data, error } = await adminClient()
      .from("newsletter_forms")
      .update({ ...toRow(input), updated_at: new Date().toISOString() })
      .eq("workspace_id", auth.workspaceId)
      .eq("id", id)
      .select(FORM_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Formulier niet gevonden.");
    await audit(auth.workspaceId, auth.user.id, "newsletter_form_updated");
    return NextResponse.json({ form: data });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Controleer de gegevens van het formulier."));
    return failure(e);
  }
}

// Deleting a form stops new signups through it. Subscribers and their consent
// records (which keep a copy of the consent text) stay.
export async function DELETE(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    const id = formId((await params).id);
    const { data, error } = await adminClient().from("newsletter_forms").delete().eq("workspace_id", auth.workspaceId).eq("id", id).select("id");
    if (error) throw error;
    if (!data?.length) throw new HttpError(404, "Formulier niet gevonden.");
    await audit(auth.workspaceId, auth.user.id, "newsletter_form_deleted");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
