import { NextResponse } from "next/server";
import { platformAdmin, failure, limited, HttpError } from "@/lib/server/access";
import { adminClient } from "@/lib/server/supabase";
import { billingState } from "@/lib/billing-state";
import { DIAG_PREFIX } from "@/lib/server/webhook-diagnostics";

// Mavix staff only: everything about one workspace for the detail panel in
// /beheer: subscription, price, invoices, integrations, members, AI usage
// and recent events (event names only, never customer content).
const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await platformAdmin();
    await limited("admin:" + user.id, 120);
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "Ongeldige werkruimte.");
    const db = adminClient();
    const { data: ws, error } = await db.from("workspaces").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
    if (error) throw new HttpError(503, "De werkruimte kon niet worden geladen.");
    if (!ws) throw new HttpError(404, "Werkruimte niet gevonden.");
    const [subs, conns, members, usage, audit, invoices] = await Promise.all([
      db.from("subscriptions").select("plan,status,billing_interval,current_period_end,provider_subscription_id").eq("workspace_id", id).maybeSingle(),
      db.from("integration_connections").select("provider,status,display_name,account_email,updated_at").eq("workspace_id", id),
      db.from("workspace_members").select("user_id,role").eq("workspace_id", id),
      db.from("ai_usage").select("input_tokens,output_tokens,cost_micro_usd,feature").eq("workspace_id", id).gte("created_at", monthStart()).limit(50000),
      db.from("audit_logs").select("event,created_at").eq("workspace_id", id).order("created_at", { ascending: false }).limit(60),
      db.from("workspace_invoices").select("id,period,amount_cents,status,paid_at,note").eq("workspace_id", id).order("period", { ascending: false }).limit(48),
    ]);
    const people = await Promise.all(
      (members.data || []).map(async (m) => {
        const { data } = await db.auth.admin.getUserById(m.user_id as string);
        return { email: data?.user?.email || "onbekend", role: m.role as string, lastSignIn: data?.user?.last_sign_in_at || null };
      }),
    );
    const rows = usage.data || [];
    const s = subs.data;
    return NextResponse.json(
      {
        id: ws.id,
        name: ws.name,
        status: ws.access_status,
        createdAt: ws.created_at,
        aiLimit: ws.ai_monthly_token_limit,
        priceCents: (ws as { monthly_price_cents?: number | null }).monthly_price_cents ?? null,
        note: (ws as { admin_note?: string | null }).admin_note ?? "",
        subscription: {
          plan: s?.plan || null,
          state: billingState(s ? { plan: s.plan, status: s.status, billing_interval: s.billing_interval, current_period_end: s.current_period_end } : null),
          interval: s?.billing_interval || null,
          periodEnd: s?.current_period_end || null,
          viaStripe: !!s?.provider_subscription_id,
        },
        usage: {
          tokens: rows.reduce((t, u) => t + Number(u.input_tokens || 0) + Number(u.output_tokens || 0), 0),
          costUsd: Math.round(rows.reduce((t, u) => t + Number(u.cost_micro_usd || 0), 0) / 10_000) / 100,
          requests: rows.length,
        },
        members: people,
        integrations: (conns.data || []).map((c) => ({ provider: c.provider, status: c.status, name: c.display_name || c.account_email || null, updatedAt: c.updated_at })),
        // invoices: null when the table does not exist yet (migration pending).
        invoices: invoices.error ? null : (invoices.data || []).map((i) => ({ id: i.id, period: i.period, amountCents: i.amount_cents, status: i.status, paidAt: i.paid_at, note: i.note })),
        events: (audit.data || []).filter((a) => !String(a.event).startsWith(DIAG_PREFIX)).map((a) => ({ event: a.event, at: a.created_at })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
