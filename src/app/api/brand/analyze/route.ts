import { NextResponse } from "next/server";
import { z } from "zod";
import { failure, HttpError, limited, sameOrigin, workspace } from "@/lib/server/access";
import { robotsAllows, safeFetchPage } from "@/lib/server/safe-fetch";
import { analyzeWebsite } from "@/lib/server/ai";
import { metered } from "@/lib/server/ai-usage";

// "Website opnieuw analyseren" in Brand Hub: reads the homepage plus a few
// relevant pages of the same site (menu, products, services, about) and lets
// AI list the current offer. Suggestions only; the owner chooses what to keep.
const input = z.object({ url: z.string().trim().min(4).max(300) });
const RELEVANT = /(menu|kaart|product|dienst|aanbod|assortiment|gerecht|prijzen|over-ons|about|shop|winkel|behandeling|collectie)/i;

const toText = (html: string) =>
  html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("brand-analyze:" + auth.user.id, 4);
    const { url } = input.parse(await request.json());
    const start = /^https?:\/\//i.test(url) ? url : "https://" + url;
    if (!(await robotsAllows(start))) throw new HttpError(403, "Deze website staat niet toe dat Mavix de pagina leest (robots.txt).");
    const home = await safeFetchPage(start, { timeoutMs: 8000, maxBytes: 1_500_000 }).catch(() => null);
    if (!home || home.status >= 400 || !home.html) throw new HttpError(400, "Mavix kon je website niet openen. Controleer het adres.");
    const origin = new URL(home.url).origin;
    const links = [...home.html.matchAll(/href=["']([^"'#]+)["']/gi)]
      .map((m) => {
        try {
          return new URL(m[1], home.url).toString();
        } catch {
          return "";
        }
      })
      .filter((u) => u.startsWith(origin) && RELEVANT.test(u) && u !== home.url);
    const pages = [{ url: home.url, text: toText(home.html).slice(0, 6000) }];
    for (const link of [...new Set(links)].slice(0, 4)) {
      if (!(await robotsAllows(link).catch(() => false))) continue;
      const p = await safeFetchPage(link, { timeoutMs: 8000, maxBytes: 1_500_000 }).catch(() => null);
      if (p && p.status < 400 && p.html) pages.push({ url: p.url, text: toText(p.html).slice(0, 5000) });
    }
    const analysis = await metered(auth, "brand_improve", () => analyzeWebsite(pages), request.headers.get("idempotency-key"));
    return NextResponse.json({ pages: pages.map((p) => p.url), analysis }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Vul het adres van je website in."));
    return failure(e);
  }
}
