import { NextResponse } from "next/server";
import { workspace, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { adminClient } from "@/lib/server/supabase";
import { workspacePlan } from "@/lib/server/plan";

// Premium: one personal 20-minute marketing call with someone from Mavix per
// billing period (not with the AI). Booking happens in the owner's own agenda
// tool: MAVIX_ADVICE_BOOKING_URL (https). Without it Mavix says booking is
// not open yet and never invents available slots. Unused calls do not carry over.

const bookingUrl = () => {
  const u = (process.env.MAVIX_ADVICE_BOOKING_URL || "").trim();
  return /^https:\/\/[^\s]+$/.test(u) ? u : null;
};

async function status(workspaceId: string) {
  const wp = await workspacePlan(workspaceId);
  const entitled = wp.plan.entitlements.includes("advice_call");
  const { count } = await adminClient().from("audit_logs").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("event", "advice_call_booked").gte("created_at", wp.period.start.toISOString());
  return { entitled, used: (count || 0) > 0, bookingOpen: !!bookingUrl(), periodEnd: wp.period.end.toISOString(), plan: wp.plan.name };
}

export async function GET() {
  try {
    const auth = await workspace();
    return NextResponse.json(await status(auth.workspaceId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return failure(e);
  }
}

// Opens the booking: records the call for this period, then returns the link.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("advice:" + auth.user.id, 5);
    const s = await status(auth.workspaceId);
    if (!s.entitled) throw new HttpError(402, "Het persoonlijke marketingadvies hoort bij Premium.");
    const url = bookingUrl();
    if (!url) throw new HttpError(503, "Afspraken inplannen is nog niet geopend. Mavix neemt contact met je op om een moment te kiezen.");
    if (s.used) throw new HttpError(409, `Je hebt het adviesgesprek van deze periode al ingepland. Vanaf ${new Date(s.periodEnd).toLocaleDateString("nl-NL", { day: "numeric", month: "long" })} kun je een nieuw gesprek plannen.`);
    await adminClient().from("audit_logs").insert({ workspace_id: auth.workspaceId, actor_id: auth.user.id, event: "advice_call_booked", created_at: new Date().toISOString() });
    return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}
