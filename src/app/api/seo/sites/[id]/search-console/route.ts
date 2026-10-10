import { NextResponse } from "next/server";
import { z } from "zod";
import { failure, HttpError, limited, workspace } from "@/lib/server/access";
import { siteRow, updateSite } from "@/lib/server/seo";
import { gscConnection, gscStatus, listProperties, matchProperty, searchPerformance } from "@/lib/server/search-console";

type Context = { params: Promise<{ id: string }> };
const query = z.object({ days: z.enum(["7", "28", "90"]).default("28") });

// Private Search Console data for one website: only for properties the
// connected Google account can read. Fetched live from Google, not stored.
export async function GET(request: Request, { params }: Context) {
  try {
    const auth = await workspace();
    await limited("seo-gsc:" + auth.user.id, 60);
    const { days } = query.parse(Object.fromEntries(new URL(request.url).searchParams));
    const site = await siteRow(auth.workspaceId, (await params).id);
    const status = gscStatus(await gscConnection(auth.workspaceId));
    if (status !== "connected") return NextResponse.json({ status });
    const properties = await listProperties(auth.workspaceId);
    let property = site.gsc_property && properties.some((p) => p.siteUrl === site.gsc_property) ? site.gsc_property : null;
    if (!property) {
      property = matchProperty(site.host, properties);
      if (property && (auth.role === "OWNER" || auth.role === "ADMIN")) await updateSite(auth.workspaceId, site.id, { gscProperty: property });
    }
    if (!property) return NextResponse.json({ status: "no_property", properties });
    const data = await searchPerformance(auth.workspaceId, property, Number(days));
    return NextResponse.json({ status: "ok", properties, ...data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige periode."));
    return failure(e);
  }
}