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
/** IPv6 as 8 numbers, whatever the notation (::, leading zeros, embedded IPv4). */
function hextets(ip: string): number[] | null {
  let x = ip.toLowerCase().split("%")[0];
  const v4 = x.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number);
    x = x.slice(0, v4.index) + ((a << 8) | b).toString(16) + ":" + ((c << 8) | d).toString(16);
  }
  const [head, tail] = x.split("::");
  const h = head ? head.split(":") : [];
  const t = tail !== undefined && tail ? tail.split(":") : [];
  const parts = x.includes("::") ? [...h, ...Array(8 - h.length - t.length).fill("0"), ...t] : h;
  if (parts.length !== 8) return null;
  return parts.map((p) => parseInt(p, 16));
}
const v4of = (hi: number, lo: number) => [hi >> 8, hi & 255, lo >> 8, lo & 255].join(".");

export function isPublicAddress(ip: string) {
  const v = isIP(ip);
  if (v === 4) return !privateV4(ip);
  if (v !== 6) return false;
  const w = hextets(ip);
  if (!w || w.some((n) => Number.isNaN(n))) return false;
  const zero = (from: number, to: number) => w.slice(from, to).every((n) => n === 0);
  // ::, ::1 and IPv4-compatible ::a.b.c.d
  if (zero(0, 6)) return false;
  // IPv4-mapped ::ffff:a.b.c.d and NAT64 64:ff9b::a.b.c.d: judge the IPv4 address.
  if (zero(0, 5) && w[5] === 0xffff) return !privateV4(v4of(w[6], w[7]));
  if (w[0] === 0x64 && w[1] === 0xff9b && zero(2, 6)) return !privateV4(v4of(w[6], w[7]));
  // 6to4 2002:a.b.c.d::/48 embeds an IPv4 address too.
  if (w[0] === 0x2002) return !privateV4(v4of(w[1], w[2]));
  // Teredo, unique local fc00::/7, link-local fe80::/10, site-local, multicast.
  if (w[0] === 0x2001 && w[1] === 0) return false;
  if ((w[0] & 0xfe00) === 0xfc00 || (w[0] & 0xffc0) === 0xfe80 || (w[0] & 0xffc0) === 0xfec0 || (w[0] & 0xff00) === 0xff00) return false;
  return true;
}

async function resolvePublic(host: string) {
  if (/^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i.test(host)) throw new Error("blocked_host");
  const addrs = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true, verbatim: true });
  if (!addrs.length || addrs.some((a) => !isPublicAddress(a.address))) throw new Error("blocked_address");
  return addrs[0];
}

type Raw = { status: number; location?: string; body: string; type: string; headers: Record<string, string>; truncated: boolean };
const flat = (h: http.IncomingHttpHeaders) => Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(", ") : String(v ?? "")]));

function request(url: URL, addr: { address: string; family: number }, timeoutMs: number, maxBytes: number) {
  return new Promise<Raw>((resolve, reject) => {
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
        // Pin the connection to the address we validated. Newer Node versions
        // ask with { all: true } (happy eyeballs) and expect a list.
        lookup: (_h, options, cb) => {
          if ((options as { all?: boolean } | undefined)?.all)
            (cb as (e: null, a: { address: string; family: number }[]) => void)(null, [{ address: addr.address, family: addr.family }]);
          else (cb as (e: null, a: string, f: number) => void)(null, addr.address, addr.family);
        },
        timeout: timeoutMs,
      },
      (res) => {
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > maxBytes) {
            req.destroy();
            resolve({ status: res.statusCode || 0, location: res.headers.location, body: Buffer.concat(chunks).toString("utf8"), type: String(res.headers["content-type"] || ""), headers: flat(res.headers), truncated: true });
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => resolve({ status: res.statusCode || 0, location: res.headers.location, body: Buffer.concat(chunks).toString("utf8"), type: String(res.headers["content-type"] || ""), headers: flat(res.headers), truncated: false }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

/** Throws "blocked_url"/"blocked_host"/"blocked_address" for anything that is not a public http(s) URL. */
export async function assertPublicUrl(input: string) {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol) || (url.port && !["80", "443"].includes(url.port)) || url.username || url.password) throw new Error("blocked_url");
  await resolvePublic(url.hostname);
  return url;
}

/**
 * Like safeFetchPage, with response headers and the redirect chain (every hop
 * re-validated). Used by the SEO crawler.
 */
export async function safeFetch(input: string, { timeoutMs = 8000, maxBytes = 1_500_000, maxRedirects = 3 } = {}) {
  let url = new URL(/^https?:\/\//i.test(input) ? input : "https://" + input);
  const started = Date.now();
  const chain: { url: string; status: number }[] = [];
  for (let i = 0; i <= maxRedirects; i++) {
    if (!["http:", "https:"].includes(url.protocol) || (url.port && !["80", "443"].includes(url.port)) || url.username || url.password) throw new Error("blocked_url");
    const addr = await resolvePublic(url.hostname);
    const res = await request(url, addr, timeoutMs, maxBytes);
    if (res.status >= 300 && res.status < 400 && res.location) {
      chain.push({ url: url.toString(), status: res.status });
      url = new URL(res.location, url);
      continue;
    }
    return { url: url.toString(), status: res.status, body: res.body, type: res.type, headers: res.headers, chain, truncated: res.truncated, ms: Date.now() - started };
  }
  throw new Error("too_many_redirects");
}

export async function safeFetchPage(input: string, { timeoutMs = 8000, maxBytes = 1_500_000, maxRedirects = 3 } = {}) {
  const r = await safeFetch(input, { timeoutMs, maxBytes, maxRedirects });
  return { url: r.url, status: r.status, html: /html|xml|text/i.test(r.type) ? r.body : "", ms: r.ms };
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
