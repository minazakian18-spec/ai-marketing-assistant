import { NextResponse } from "next/server";
import { audit, failure, HttpError, sameOrigin, workspace } from "@/lib/server/access";
import { adminClient } from "@/lib/server/supabase";
import { erase, unsubscribeUrl } from "@/lib/server/newsletter";

type Context = { params: Promise<{ id: string }> };
const subscriberId = (id: string) => {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, "Abonnee niet gevonden.");
  return id;
};

// Consent record of one subscriber (for the Contacts module). IP hashes are
// not returned.
export async function GET(_request: Request, { params }: Context) {
  try {
    const auth = await workspace();
    const id = subscriberId((await params).id);
    const db = adminClient();
    const { data: s, error } = await db
      .from("newsletter_subscribers")
      .select("id,email,name,status,source,privacy_policy_version,subscribed_at,confirmed_at,unsubscribed_at,created_at")
      .eq("workspace_id", auth.workspaceId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!s) throw new HttpError(404, "Abonnee niet gevonden.");
    const { data: events, error: eventsError } = await db
      .from("newsletter_consent_events")
      .select("event,consent_text,privacy_policy_version,privacy_policy_url,page_url,method,created_at")
      .eq("workspace_id", auth.workspaceId)
      .eq("subscriber_id", id)
      .order("created_at", { ascending: true });
    if (eventsError) throw eventsError;
    return NextResponse.json({ subscriber: s, events, unsubscribeUrl: unsubscribeUrl(s.id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return failure(e);
  }
}

// GDPR erasure (OWNER/ADMIN): subscriber and consent records are removed; a
// hashed suppression entry remains so the address is never mailed again.
export async function DELETE(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await erase(auth.workspaceId, subscriberId((await params).id));
    await audit(auth.workspaceId, auth.user.id, "newsletter_subscriber_erased");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
