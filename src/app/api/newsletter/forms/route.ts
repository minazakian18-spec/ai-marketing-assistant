import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, failure, HttpError, limited, sameOrigin, workspace } from "@/lib/server/access";
import { adminClient, appUrl } from "@/lib/server/supabase";
import { emailConfigured, FORM_COLUMNS, newFormKey } from "@/lib/server/newsletter";
import { checkDoubleOptIn, formInput, toRow } from "@/lib/server/newsletter-forms";

// Newsletter signup forms of the current workspace.

export async function GET() {
  try {
    const auth = await workspace();
    const { data, error } = await adminClient().from("newsletter_forms").select(FORM_COLUMNS).eq("workspace_id", auth.workspaceId).order("created_at");
    if (error) throw error;
    return NextResponse.json(
      { forms: data, emailConfigured: emailConfigured(), endpoint: appUrl() + "/api/newsletter/subscribe", hostedBase: appUrl() + "/nieuwsbrief/" },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("newsletter-forms:" + auth.user.id, 20);
    const input = formInput.parse(await request.json());
    checkDoubleOptIn(input);
    const { data, error } = await adminClient()
      .from("newsletter_forms")
      .insert({ ...toRow(input), workspace_id: auth.workspaceId, public_key: newFormKey(), created_by: auth.user.id })
      .select(FORM_COLUMNS)
      .single();
    if (error) throw error;
    await audit(auth.workspaceId, auth.user.id, "newsletter_form_created");
    return NextResponse.json({ form: data });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Controleer de gegevens van het formulier."));
    return failure(e);
  }
}
