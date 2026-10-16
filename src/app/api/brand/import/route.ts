import { NextResponse } from "next/server";
import { z } from "zod";
import { failure, HttpError, limited, sameOrigin, workspace } from "@/lib/server/access";
import { robotsAllows, safeFetchPage } from "@/lib/server/safe-fetch";
import { extractFacts } from "@/lib/brand-import";

// Reads facts from the business's own public homepage for Brand Hub. Returns
// suggestions only; the browser shows them for confirmation and nothing is
// saved here. Private addresses, other ports and robots.txt refusals are
// blocked (safe-fetch).
const input = z.object({ url: z.string().trim().min(4).max(300) });

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("brand-import:" + auth.user.id, 6);
    const { url } = input.parse(await request.json());
    let page;
    try {
      const target = /^https?:\/\//i.test(url) ? url : "https://" + url;
      if (!(await robotsAllows(target))) throw new HttpError(403, "Deze website staat niet toe dat Mavix de pagina leest (robots.txt).");
      page = await safeFetchPage(target, { timeoutMs: 8000, maxBytes: 1_500_000 });
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(400, "Mavix kon deze website niet openen. Controleer het adres.");
    }
    if (page.status >= 400 || !page.html) throw new HttpError(400, "Deze pagina gaf geen leesbare inhoud terug.");
    const facts = extractFacts(page.html);
    return NextResponse.json({ url: page.url, facts }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Vul het adres van je website in."));
    return failure(e);
  }
}
