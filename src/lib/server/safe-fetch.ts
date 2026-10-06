import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import http from "node:http";
import https from "node:https";

// Fetch a public web page on behalf of a workspace without SSRF risk:
// http/https only on ports 80/443, every resolved address must be public
// (no loopback, private, link-local, CGNAT, metadata or multicast ranges),
// the connection is pinned to the validated address (no DNS rebinding),
// redirects are re-validated, and time and size are limited.

export const MAVIX_UA = "MavixBot/1.0 (+https://mavix.webbo-solutions.nl)";

function privateV4(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}
export function isPublicAddress(ip: string) {
  const v = isIP(ip);
  if (v === 4) return !privateV4(ip);
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === "::" || x === "::1") return false;
    const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return !privateV4(mapped[1]);
    return !/^(fc|fd|fe8|fe9|fea|feb|ff)/.test(x);
  }
  return false;
}

async function resolvePublic(host: string) {
  if (/^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i.test(host)) throw new Error("blocked_host");
  const addrs = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true, verbatim: true });
  if (!addrs.length || addrs.some((a) => !isPublicAddress(a.address))) throw new Error("blocked_address");
  return addrs[0];
}

function request(url: URL, addr: { address: string; family: number }, timeoutMs: number, maxBytes: number) {
  return new Promise<{ status: number; location?: string; body: string; type: string }>((resolve, reject) => {
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search,
        method: "GET",
        servername: isIP(url.hostname) ? undefined : url.hostname,
        headers: { "User-Agent": MAVIX_UA, Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5", "Accept-Language": "nl,en;q=0.8" },
        // Pin the connection to the address we validated.
        lookup: (_h, _o, cb) => (cb as (e: null, a: string, f: number) => void)(null, addr.address, addr.family),
        timeout: timeoutMs,
      },
      (res) => {
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > maxBytes) {
            req.destroy();
            resolve({ status: res.statusCode || 0, location: res.headers.location, body: Buffer.concat(chunks).toString("utf8"), type: String(res.headers["content-type"] || "") });
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => resolve({ status: res.statusCode || 0, location: res.headers.location, body: Buffer.concat(chunks).toString("utf8"), type: String(res.headers["content-type"] || "") }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

export async function safeFetchPage(input: string, { timeoutMs = 8000, maxBytes = 1_500_000, maxRedirects = 3 } = {}) {
  let url = new URL(/^https?:\/\//i.test(input) ? input : "https://" + input);
  const started = Date.now();
  for (let i = 0; i <= maxRedirects; i++) {
    if (!["http:", "https:"].includes(url.protocol) || (url.port && !["80", "443"].includes(url.port)) || url.username || url.password) throw new Error("blocked_url");
    const addr = await resolvePublic(url.hostname);
    const res = await request(url, addr, timeoutMs, maxBytes);
    if (res.status >= 300 && res.status < 400 && res.location) {
      url = new URL(res.location, url);
      continue;
    }
    return { url: url.toString(), status: res.status, html: /html|xml|text/i.test(res.type) ? res.body : "", ms: Date.now() - started };
  }
  throw new Error("too_many_redirects");
}

// Minimal robots.txt check for our user agent / "*" on a single path.
export async function robotsAllows(pageUrl: string) {
  try {
    const u = new URL(pageUrl);
    const r = await safeFetchPage(u.origin + "/robots.txt", { timeoutMs: 4000, maxBytes: 200_000, maxRedirects: 2 });
    if (r.status !== 200) return true;
    let applies = false;
    const disallows: string[] = [];
    for (const raw of r.html.split(/\r?\n/)) {
      const line = raw.replace(/#.*/, "").trim();
      const [k, ...rest] = line.split(":");
      const v = rest.join(":").trim();
      if (/^user-agent$/i.test(k)) applies = v === "*" || /mavixbot/i.test(v);
      else if (applies && /^disallow$/i.test(k) && v) disallows.push(v);
    }
    return !disallows.some((d) => u.pathname.startsWith(d));
  } catch {
    return true;
  }
}
