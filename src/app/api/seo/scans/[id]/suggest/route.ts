import { NextResponse } from "next/server";
import { z } from "zod";
import { failure, HttpError, limited, sameOrigin, workspace } from "@/lib/server/access";
import { adminClient } from "@/lib/server/supabase";
import { getScan } from "@/lib/server/seo";
import { generateSeoSuggestions } from "@/lib/server/ai";
import { metered } from "@/lib/server/ai-usage";

type Context = { params: Promise<{ id: string }> };
const input = z.object({ url: z.string().max(2000), kind: z.enum(["title", "description", "structure"]) });

// AI alternatives for one page of a completed scan. The page facts come from
// the stored scan, never from the browser. Suggestions are text to copy;
// nothing is changed on the website.
export async function POST(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("seo-ai:" + auth.user.id, 10);
    await limited("seo-ai-ws:" + auth.workspaceId, 40);
    const body = input.parse(await request.json());
    const scan = await getScan(auth.workspaceId, (await params).id);
    const page = scan.report?.pages.find((p) => p.url === body.url);
    if (!page) throw new HttpError(404, "Deze pagina hoort niet bij deze analyse.");
    const { data } = await adminClient().from("business_profiles").select("data").eq("workspace_id", auth.workspaceId).maybeSingle();
    const profile = ((data?.data as { profile?: Record<string, unknown> } | undefined)?.profile || {}) as Record<string, unknown>;
    const suggestions = await metered(
      auth,
      "seo_suggest",
      () => generateSeoSuggestions(body.kind, { url: page.url, title: page.title, metaDescription: page.metaDescription, h1: page.h1, textSample: page.textSample, keyword: scan.report?.site.keyword || "" }, profile),
      request.headers.get("idempotency-key"),
    );
    return NextResponse.json({ suggestions }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige aanvraag."));
    return failure(e);
  }
}