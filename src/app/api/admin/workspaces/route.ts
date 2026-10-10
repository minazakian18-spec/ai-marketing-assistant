import { NextResponse } from "next/server";
import { z } from "zod";
import { platformAdmin, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { adminClient } from "@/lib/server/supabase";

// Private beta administration (Mavix staff only, public.platform_admins):
// list workspaces and approve, pause or set an AI quota. No customer content
// is returned: names, status, owner e-mail and this month's token count.

const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

export async function GET() {
  try {
    const { user } = await platformAdmin();
    await limited("admin:" + user.id, 60);
    const db = adminClient();
    const { data: spaces, error } = await db
      .from("workspaces")
      .select("id,name,access_status,ai_monthly_token_limit,created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new HttpError(503, "Werkruimtes konden niet worden geladen.");
    const ids = (spaces || []).map((s) => s.id as string);
    const [{ data: owners }, { data: usage }] = await Promise.all([
      ids.length ? db.from("workspace_members").select("workspace_id,user_id").eq("role", "OWNER").in("workspace_id", ids) : Promise.resolve({ data: [] }),
      ids.length ? db.from("ai_usage").select("workspace_id,input_tokens,output_tokens").gte("created_at", monthStart()).in("workspace_id", ids).limit(50000) : Promise.resolve({ data: [] }),
    ]);
    const emails = new Map<string, string>();
    for (const o of owners || []) {
      if (emails.has(o.workspace_id as string)) continue;
      const { data } = await db.auth.admin.getUserById(o.user_id as string);
      if (data?.user?.email) emails.set(o.workspace_id as string, data.user.email);
    }
    const tokens = new Map<string, number>();
    for (const u of usage || []) tokens.set(u.workspace_id as string, (tokens.get(u.workspace_id as string) || 0) + (u.input_tokens as number) + (u.output_tokens as number));
    return NextResponse.json(
      {
        workspaces: (spaces || []).map((s) => ({
          id: s.id,
          name: s.name,
          status: s.access_status,
          aiLimit: s.ai_monthly_token_limit,
          createdAt: s.created_at,
          ownerEmail: emails.get(s.id as string) || null,
          tokensThisMonth: tokens.get(s.id as string) || 0,
        })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}

const input = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "pending", "suspended"]).optional(),
  aiLimit: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
});

export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const { user } = await platformAdmin();
    await limited("admin-write:" + user.id, 30);
    const body = input.parse(await request.json());
    const change: Record<string, unknown> = {};
    if (body.status) Object.assign(change, { access_status: body.status, access_changed_at: new Date().toISOString() });
    if (body.aiLimit !== undefined) change.ai_monthly_token_limit = body.aiLimit;
    if (!Object.keys(change).length) throw new HttpError(400, "Geen wijziging opgegeven.");
    const db = adminClient();
    const { data, error } = await db.from("workspaces").update(change).eq("id", body.id).is("deleted_at", null).select("id").maybeSingle();
    if (error) throw new HttpError(503, "Opslaan is niet gelukt.");
    if (!data) throw new HttpError(404, "Werkruimte niet gevonden.");
    await db.from("audit_logs").insert({ workspace_id: body.id, actor_id: user.id, event: body.status ? "beta_access_" + body.status : "ai_limit_changed" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige aanvraag."));
    return failure(e);
  }
}
