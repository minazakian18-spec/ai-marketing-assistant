import { NextResponse } from "next/server";
import { platformAdmin } from "@/lib/server/access";

// Whether the signed-in user is Mavix staff (public.platform_admins), using
// the same server check as every /api/admin route. Only drives the visibility
// of the "Beheer" link; the admin routes keep enforcing access themselves.
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    await platformAdmin();
    return NextResponse.json({ admin: true }, { headers });
  } catch {
    return NextResponse.json({ admin: false }, { headers });
  }
}
