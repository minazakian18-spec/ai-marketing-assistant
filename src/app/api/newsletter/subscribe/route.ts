import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, limited } from "@/lib/server/access";
import { appUrl } from "@/lib/server/supabase";
import { evidenceFrom, formByKey, ipHash, originAllowed, subscribe } from "@/lib/server/newsletter";

// Public newsletter signup for embedded and hosted forms. Accepts JSON (fetch,
// CORS) or a plain HTML form post (redirect). Consent must be given
// explicitly with the checkbox; the hidden "website" field is a honeypot.

const input = z.object({
  form: z.string().max(64),
  email: z.string().trim().email().max(254),
  name: z.string().trim().max(120).optional(),
  consent: z.union([z.literal(true), z.enum(["on", "yes", "true", "1"])]),
  website: z.string().max(200).optional(),
  page: z.string().max(500).optional(),
});

const cors = (origin: string | null): Record<string, string> =>
  origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" } : {};

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request.headers.get("origin")) });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const json = (request.headers.get("content-type") || "").includes("application/json");
  const status = (s: string, redirect?: string | null) =>
    json
      ? NextResponse.json({ ok: s === "subscribed" || s === "pending", status: s }, { status: s === "subscribed" || s === "pending" ? 200 : s === "invalid" ? 400 : s === "forbidden" ? 403 : s === "busy" ? 429 : 503, headers: { ...cors(origin), "Cache-Control": "no-store" } })
      : NextResponse.redirect(redirect && (s === "subscribed" || s === "pending") ? redirect : new URL("/nieuwsbrief/status?s=" + s, appUrl()), 303);
  try {
    if (Number(request.headers.get("content-length") || 0) > 20_000) return status("invalid");
    let raw: Record<string, unknown>;
    try {
      raw = json ? await request.json() : Object.fromEntries(await request.formData());
    } catch {
      return status("invalid");
    }
    const parsed = input.safeParse(raw);
    if (!parsed.success) return status("invalid");
    const body = parsed.data;
    const evidence = evidenceFrom(request, body.page || null);
    await limited("newsletter-ip:" + (ipHash(evidence.ip) || "unknown"), 10);
    const form = await formByKey(body.form);
    if (!form) return status("invalid");
    if (!originAllowed(form, origin)) return status("forbidden");
    await limited("newsletter-form:" + form.id, 120);
    // Bots fill the hidden field: answer as if it worked, store nothing.
    if (body.website) return status(form.double_opt_in ? "pending" : "subscribed", form.redirect_url);
    const result = await subscribe(form, { email: body.email, name: body.name }, evidence);
    return status(result.status, form.redirect_url);
  } catch (e) {
    if (e instanceof HttpError && e.status === 429) return status("busy");
    console.error(JSON.stringify({ event: "newsletter_subscribe_failed", code: e instanceof HttpError ? e.status : (e as { code?: string })?.code || "error" }));
    return status("error");
  }
}
