import { timingSafeEqual } from "node:crypto";

/** True when the request carries "Authorization: Bearer <CRON_SECRET>" (constant-time compare). */
export function cronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET || "";
  const a = Buffer.from((request.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""));
  const b = Buffer.from(secret);
  return !!secret && a.length === b.length && timingSafeEqual(a, b);
}
