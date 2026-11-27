import { NextResponse } from "next/server";
import { z } from "zod";
import { platformAdmin, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { adminClient } from "@/lib/server/supabase";

// Mavix staff only: invoices kept by hand per workspace (public.workspace_invoices).
// Create one per month, mark it paid, open, overdue or void, or remove it.
const create = z.object({
  workspaceId: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  amountCents: z.number().int().min(0).max(100_000_000),
  note: z.string().trim().max(500).optional(),
});
const change = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "paid", "overdue", "void"]).optional(),
  amountCents: z.number().int().min(0).max(100_000_000).optional(),
  note: z.string().trim().max(500).optional(),
});
const remove = z.object({ id: z.string().uuid() });

const notReady = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205";
async function guard(request: Request) {
  sameOrigin(request);
  const { user } = await platformAdmin();
  await limited("admin-write:" + user.id, 60);
  return user;
}

export async function POST(request: Request) {
  try {
    const user = await guard(request);
    const b = create.parse(await request.json());
    const db = adminClient();
    const { data, error } = await db
      .from("workspace_invoices")
      .insert({ workspace_id: b.workspaceId, period: b.period + "-01", amount_cents: b.amountCents, note: b.note || null })
      .select("id")
      .single();
    if (error?.code === "23505") throw new HttpError(409, "Voor deze maand bestaat al een factuur.");
    if (error) throw new HttpError(503, notReady(error) ? "Facturen worden nog ingericht (database-migratie)." : "De factuur kon niet worden opgeslagen.");
    await db.from("audit_logs").insert({ workspace_id: b.workspaceId, actor_id: user.id, event: "invoice_created" });
    return NextResponse.json({ id: data.id });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige factuur."));
    return failure(e);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await guard(request);
    const b = change.parse(await request.json());
    const patch: Record<string, unknown> = {};
    if (b.status) Object.assign(patch, { status: b.status, paid_at: b.status === "paid" ? new Date().toISOString() : null });
    if (b.amountCents !== undefined) patch.amount_cents = b.amountCents;
    if (b.note !== undefined) patch.note = b.note || null;
    if (!Object.keys(patch).length) throw new HttpError(400, "Geen wijziging opgegeven.");
    const db = adminClient();
    const { data, error } = await db.from("workspace_invoices").update(patch).eq("id", b.id).select("workspace_id").maybeSingle();
    if (error) throw new HttpError(503, "De factuur kon niet worden bijgewerkt.");
    if (!data) throw new HttpError(404, "Factuur niet gevonden.");
    if (b.status) await db.from("audit_logs").insert({ workspace_id: data.workspace_id, actor_id: user.id, event: "invoice_" + b.status });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige aanvraag."));
    return failure(e);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await guard(request);
    const b = remove.parse(await request.json());
    const db = adminClient();
    const { data, error } = await db.from("workspace_invoices").delete().eq("id", b.id).select("workspace_id").maybeSingle();
    if (error) throw new HttpError(503, "De factuur kon niet worden verwijderd.");
    if (!data) throw new HttpError(404, "Factuur niet gevonden.");
    await db.from("audit_logs").insert({ workspace_id: data.workspace_id, actor_id: user.id, event: "invoice_deleted" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige aanvraag."));
    return failure(e);
  }
}
