import "server-only";
import { randomUUID } from "node:crypto";
import { adminClient } from "./supabase";
import { HttpError } from "./access";
import { graph, igGraph, metaConfigured, metaConnection } from "./meta";
import { mutateWorkspace, readWorkspace } from "./workspace-store";
import { instagramCaption, publishProblems } from "../instagram-publish";
import { mediaIdOf } from "../media-ref";
import { readImage } from "./library";
import type { Post } from "../types";

// Instagram publishing through Meta's official Content Publishing API.
//
//   1. create a media container per photo (carousel: one per item, then a
//      CAROUSEL container), using a short-lived signed URL of a temporary
//      JPEG copy in Mavix storage (Meta downloads the image from that URL);
//   2. wait until the container is FINISHED;
//   3. media_publish, then read the permalink.
//
// Required permission on the connection: instagram_content_publish (Facebook
// Login for Business) or instagram_business_content_publish (Business Login
// for Instagram). Without it Mavix refuses and says so; it never pretends a
// post was published. A post only becomes "published" after Instagram
// returned a media id. Each post can be published once (database claim).

export const PUBLISH_SCOPES = ["instagram_content_publish", "instagram_business_content_publish"];
const BUCKET = "library";
const db = () => adminClient();

export type PublishCapability = { ready: boolean; code: "ready" | "not_configured" | "not_connected" | "reconnect" | "permission_missing" | "disabled"; message: string; account?: string };

/** Whether this workspace can really publish to Instagram right now. */
export async function publishCapability(workspaceId: string): Promise<PublishCapability> {
  if (process.env.INSTAGRAM_PUBLISHING === "off") return { ready: false, code: "disabled", message: "Publiceren naar Instagram is tijdelijk uitgeschakeld door Mavix." };
  if (!metaConfigured("instagram")) return { ready: false, code: "not_configured", message: "Instagram-koppelingen zijn in Mavix nog niet ingericht." };
  const { data: c } = await db().from("integration_connections").select("status,scopes,display_name,provider_account_id").eq("workspace_id", workspaceId).eq("provider", "instagram").maybeSingle();
  if (!c || c.status === "disconnected") return { ready: false, code: "not_connected", message: "Koppel eerst je Instagram-account." };
  if (c.status !== "connected" || !c.provider_account_id) return { ready: false, code: "reconnect", message: "Koppel Instagram opnieuw of kies je account." };
  const scopes = (c.scopes || []) as string[];
  if (!scopes.some((s) => PUBLISH_SCOPES.includes(s)))
    return {
      ready: false,
      code: "permission_missing",
      account: c.display_name || undefined,
      message: "Je Instagram-koppeling heeft nog geen toestemming om te publiceren. Dit vraagt een extra Meta-toestemming (instagram_content_publish) die Meta eerst moet goedkeuren; daarna koppel je Instagram opnieuw.",
    };
  return { ready: true, code: "ready", message: "Klaar om te publiceren.", account: c.display_name || undefined };
}

type Graph = { base: string; host: (path: string) => string; headers: Record<string, string> };

async function call(url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(20000) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw metaPublishError(r.status, data?.error);
  return data as Record<string, unknown>;
}

/** Dutch, user-safe messages for publishing errors (details only in logs). */
export function metaPublishError(status: number, e: { code?: number; error_subcode?: number; message?: string } | undefined) {
  const code = e?.code,
    sub = e?.error_subcode;
  console.error(JSON.stringify({ event: "instagram_publish_error", status, code: code ?? null, sub: sub ?? null }));
  if (code === 190 || status === 401) return Object.assign(new HttpError(409, "De Instagram-koppeling is verlopen. Koppel Instagram opnieuw."), { connection: "reconnect_required" });
  if (code === 10 || code === 200 || code === 3) return new HttpError(403, "Meta staat Mavix (nog) niet toe om op dit account te publiceren.");
  if (sub === 2207042 || code === 9) return new HttpError(429, "Instagram staat maximaal 100 publicaties per 24 uur toe. Probeer het later opnieuw.");
  if (code === 4 || code === 17 || code === 32 || code === 613 || status === 429) return new HttpError(429, "Instagram is even druk. Probeer het over een paar minuten opnieuw.");
  if (code === 36003 || sub === 2207009) return new HttpError(400, "Instagram accepteert deze beeldverhouding niet. Gebruik een foto tussen 4:5 (staand) en 1,91:1 (liggend).");
  if (code === 9004 || sub === 2207052) return new HttpError(400, "Instagram kon de foto niet ophalen. Probeer het opnieuw.");
  if (status >= 500) return new HttpError(503, "Instagram is tijdelijk niet bereikbaar. Er is niets gepubliceerd.");
  return new HttpError(400, "Instagram heeft deze publicatie geweigerd. Er is niets gepubliceerd.");
}

/** JPEG bytes for Instagram (PNG/WebP are converted when the image library is available). */
async function toJpeg(workspaceId: string, src: string): Promise<Buffer> {
  let m: string[] | null = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(src);
  let bytes: Buffer;
  const ref = mediaIdOf(src);
  if (ref) {
    // Bibliotheek image of this workspace (private storage).
    const file = await readImage(workspaceId, ref);
    bytes = file.data;
    m = ["", file.mime.split("/")[1], ""];
  } else {
    if (!m) throw new HttpError(400, "Gebruik JPG-, PNG- of WebP-foto's.");
    bytes = Buffer.from(m[2], "base64");
  }
  type Sharp = (b: Buffer) => { metadata(): Promise<{ width?: number; height?: number }>; jpeg(o: { quality: number }): { toBuffer(): Promise<Buffer> } };
  // sharp ships with Next.js for image optimisation; without it only JPEG is accepted.
  const sharp = await import("sharp").then((m) => m.default as unknown as Sharp).catch(() => null as Sharp | null);
  if (!sharp) {
    if (m[1] !== "jpeg") throw new HttpError(400, "Instagram accepteert alleen JPG-foto's. Gebruik een JPG-bestand.");
    return bytes;
  }
  const img = sharp(bytes);
  const { width = 0, height = 0 } = await img.metadata().catch(() => {
    throw new HttpError(400, "Deze foto kon niet worden gelezen. Kies een andere foto.");
  });
  const ratio = height ? width / height : 0;
  if (!ratio || ratio < 0.8 - 0.01 || ratio > 1.91 + 0.01) throw new HttpError(400, "Instagram accepteert deze beeldverhouding niet. Gebruik een foto tussen 4:5 (staand) en 1,91:1 (liggend).");
  return m[1] === "jpeg" ? bytes : img.jpeg({ quality: 90 }).toBuffer();
}

async function waitFinished(g: Graph, container: string) {
  for (let i = 0; i < 15; i++) {
    const d = await call(g.host("/" + container + "?fields=status_code"), { headers: g.headers });
    if (d.status_code === "FINISHED") return;
    if (d.status_code === "ERROR" || d.status_code === "EXPIRED") throw new HttpError(400, "Instagram kon de foto niet verwerken. Er is niets gepubliceerd.");
    await new Promise((r) => setTimeout(r, Number(process.env.INSTAGRAM_POLL_MS ?? 2000)));
  }
  throw new HttpError(504, "Instagram had te lang nodig om de foto te verwerken. Er is niets gepubliceerd; probeer het opnieuw.");
}

/** Publishes the photos and caption; returns Instagram's media id and permalink. */
async function publishToInstagram(workspaceId: string, post: Post) {
  const { creds, c } = await metaConnection(workspaceId, "instagram");
  const viaFacebook = (c.metadata as { authMode?: string } | null)?.authMode === "facebook";
  const host = viaFacebook ? graph : igGraph;
  const g: Graph = { base: host("/" + c.provider_account_id), host, headers: { Authorization: "Bearer " + creds.access_token, "Content-Type": "application/json" } };
  const uploaded: string[] = [];
  try {
    const urls: string[] = [];
    for (const m of post.media || []) {
      const path = `instagram-publish/${workspaceId}/${randomUUID()}.jpg`;
      const { error } = await db().storage.from(BUCKET).upload(path, await toJpeg(workspaceId, m), { contentType: "image/jpeg", upsert: false });
      if (error) throw new HttpError(503, "De foto kon niet worden klaargezet voor Instagram.");
      uploaded.push(path);
      const { data, error: signError } = await db().storage.from(BUCKET).createSignedUrl(path, 3600);
      if (signError || !data?.signedUrl) throw new HttpError(503, "De foto kon niet worden klaargezet voor Instagram.");
      urls.push(data.signedUrl);
    }
    const caption = instagramCaption(post);
    let container: string;
    if (urls.length === 1) {
      container = String((await call(g.base + "/media", { method: "POST", headers: g.headers, body: JSON.stringify({ image_url: urls[0], caption }) })).id);
    } else {
      const children: string[] = [];
      for (const url of urls) {
        const child = String((await call(g.base + "/media", { method: "POST", headers: g.headers, body: JSON.stringify({ image_url: url, is_carousel_item: true }) })).id);
        await waitFinished(g, child);
        children.push(child);
      }
      container = String((await call(g.base + "/media", { method: "POST", headers: g.headers, body: JSON.stringify({ media_type: "CAROUSEL", children: children.join(","), caption }) })).id);
    }
    await waitFinished(g, container);
    const mediaId = String((await call(g.base + "/media_publish", { method: "POST", headers: g.headers, body: JSON.stringify({ creation_id: container }) })).id || "");
    if (!/^\d{1,40}$/.test(mediaId)) throw new HttpError(502, "Instagram gaf geen bevestiging terug. Controleer je Instagram-account voordat je het opnieuw probeert.");
    const link = await call(host("/" + mediaId + "?fields=permalink"), { headers: g.headers }).catch(() => ({}) as Record<string, unknown>);
    const permalink = typeof link.permalink === "string" && link.permalink.startsWith("https://www.instagram.com/") ? link.permalink : undefined;
    return { mediaId, permalink };
  } catch (e) {
    const connection = (e as { connection?: string }).connection;
    if (connection) await db().from("integration_connections").update({ status: connection }).eq("id", c.id);
    throw e;
  } finally {
    if (uploaded.length) await db().storage.from(BUCKET).remove(uploaded).catch(() => {});
  }
}

/** A claim older than this without result was interrupted (Meta calls take seconds). */
const STALE_MS = 15 * 60 * 1000;

export type PublishResult ={ status: "published"; mediaId: string; permalink?: string; repeated: boolean };

/**
 * Publishes one approved or scheduled Mavix post to Instagram, at most once.
 * `trigger` is "manual" (a user clicked Publish) or "automation" (scheduler,
 * only with an explicit automation permission, see automation.ts).
 */
export async function publishPost(o: { workspaceId: string; userId: string | null; trigger: "manual" | "automation" }, postId: string): Promise<PublishResult> {
  if (!/^[\w-]{1,80}$/.test(postId)) throw new HttpError(404, "Deze post bestaat niet.");
  const { data: done } = await db().from("instagram_publications").select("id,status,media_id,permalink,updated_at").eq("workspace_id", o.workspaceId).eq("post_id", postId).in("status", ["publishing", "published"]).limit(1);
  const previous = done?.[0];
  if (previous?.status === "published") return { status: "published", mediaId: String(previous.media_id), permalink: previous.permalink || undefined, repeated: true };
  if (previous?.status === "publishing") {
    if (Date.now() - Date.parse(previous.updated_at as string) < STALE_MS) throw new HttpError(409, "Deze post wordt al gepubliceerd.");
    // Interrupted (restart, time-out): Mavix cannot know whether Instagram
    // received it. Release the claim with a warning instead of publishing
    // again on its own; the user checks Instagram and decides.
    const message = "Het publiceren is onderbroken. Controleer op Instagram of de post er al staat voordat je opnieuw publiceert.";
    await db().from("instagram_publications").update({ status: "failed", error: message, updated_at: new Date().toISOString() }).eq("id", previous.id).eq("status", "publishing");
    await mutateWorkspace(o.workspaceId, (data) => ({ data: { ...data, posts: ((data.posts || []) as Post[]).map((p) => (p.id === postId ? { ...p, failureReason: message } : p)) }, result: null })).catch(() => null);
    console.error(JSON.stringify({ event: "instagram_publish_interrupted" }));
    throw new HttpError(409, message);
  }

  const cap = await publishCapability(o.workspaceId);
  if (!cap.ready) throw new HttpError(409, cap.message);
  const ws = await readWorkspace(o.workspaceId);
  const post = ((ws.posts || []) as Post[]).find((p) => p.id === postId);
  if (!post) throw new HttpError(404, "Deze post bestaat niet.");
  if (post.status !== "approved" && post.status !== "scheduled") throw new HttpError(409, "Keur de post eerst goed. Alleen goedgekeurde of ingeplande posts kunnen worden gepubliceerd.");
  const problems = publishProblems(post);
  if (problems.length) throw new HttpError(400, problems[0]);

  // Claim: the unique index allows one 'publishing' or 'published' row per post.
  const { data: claim, error: claimError } = await db()
    .from("instagram_publications")
    .insert({ workspace_id: o.workspaceId, post_id: postId, status: "publishing", trigger: o.trigger, created_by: o.userId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .select("id")
    .single();
  if (claimError?.code === "23505") throw new HttpError(409, "Deze post wordt al gepubliceerd.");
  if (claimError || !claim) throw new HttpError(503, "Publiceren is in Mavix nog niet ingericht. Probeer het later opnieuw.");
  console.info(JSON.stringify({ event: "instagram_publish_started", trigger: o.trigger }));

  try {
    const r = await publishToInstagram(o.workspaceId, post);
    const now = new Date().toISOString();
    await db().from("instagram_publications").update({ status: "published", media_id: r.mediaId, permalink: r.permalink || null, updated_at: now }).eq("id", claim.id);
    // Instagram has the post now; record it in the workspace (retrying on concurrent saves).
    await mutateWorkspace(o.workspaceId, (data) => ({
      data: { ...data, posts: ((data.posts || []) as Post[]).map((p) => (p.id === postId ? { ...p, status: "published", failureReason: undefined, updatedAt: now, instagram: { mediaId: r.mediaId, permalink: r.permalink, publishedAt: now } } : p)) },
      result: null,
    })).catch((e) => console.error(JSON.stringify({ event: "instagram_publish_record_failed", code: (e as HttpError).status || "error" })));
    console.info(JSON.stringify({ event: "instagram_published", trigger: o.trigger }));
    return { status: "published", mediaId: r.mediaId, permalink: r.permalink, repeated: false };
  } catch (e) {
    const message = e instanceof HttpError ? e.message : "Publiceren is niet gelukt. Er is niets gepubliceerd.";
    await db().from("instagram_publications").update({ status: "failed", error: message.slice(0, 300), updated_at: new Date().toISOString() }).eq("id", claim.id);
    await mutateWorkspace(o.workspaceId, (data) => ({
      data: { ...data, posts: ((data.posts || []) as Post[]).map((p) => (p.id === postId ? { ...p, failureReason: message } : p)) },
      result: null,
    })).catch(() => {});
    throw e instanceof HttpError ? e : new HttpError(502, message);
  }
}

/** Latest publish attempts (for status screens). */
export async function recentPublications(workspaceId: string, limit = 20) {
  const { data, error } = await db().from("instagram_publications").select("post_id,status,trigger,permalink,error,created_at,updated_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(limit);
  if (error) return [];
  return data || [];
}
