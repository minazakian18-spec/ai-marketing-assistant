import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { randomBytes, createHmac } from "node:crypto";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";

// Phase 4: real Instagram publishing, e-mail campaign sending, automation
// permissions and review/calendar helpers. No real provider is ever called:
// fetch is mocked and every test asserts what would have been sent.

const origin = "https://mavix.webbo-solutions.nl";
process.env.OAUTH_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.INSTAGRAM_APP_ID = "123";
process.env.INSTAGRAM_APP_SECRET = "fixture-secret";
process.env.INSTAGRAM_POLL_MS = "0";
delete process.env.META_INSTAGRAM_CONFIG_ID;

const sharp = (await import("sharp")).default;
const JPEG = "data:image/jpeg;base64," + (await sharp({ create: { width: 100, height: 100, channels: 3, background: "#c33" } }).jpeg().toBuffer()).toString("base64");
const post = (o = {}) => ({ id: "p1", prompt: "Herfst", caption: "Ons herfstmenu", hashtags: "#herfst", status: "approved", date: "", createdAt: "1", variant: 0, contentType: "Post", media: [JPEG], ...o });

function setup({ user = "u1", scopes = ["instagram_business_basic", "instagram_business_content_publish"], posts = [post()], tables = {} } = {}) {
  tables.workspace_members ??= [
    { user_id: "u1", workspace_id: "w1", role: "OWNER", created_at: "1" },
    { user_id: "u2", workspace_id: "w1", role: "MEMBER", created_at: "1" },
  ];
  tables.workspaces ??= [{ id: "w1", deleted_at: null, access_status: "approved" }];
  tables.business_profiles ??= [{ workspace_id: "w1", version: 3, data: { profile: { name: "Telepizza", city: "Amstelveen" }, posts, email: { settings: {}, campaigns: [] }, contacts: [] } }];
  tables.instagram_publications ??= [];
  tables.email_campaign_runs ??= [];
  tables.email_deliveries ??= [];
  tables.newsletter_subscribers ??= [];
  tables.email_suppressions ??= [];
  tables.automation_permissions ??= [];
  tables.automation_runs ??= [];
  tables.audit_logs ??= [];
  const db = memoryDb(tables, { uuid: true });
  db.auth = { getUser: async () => ({ data: { user: user ? { id: user, email: user + "@example.test" } : null }, error: null }) };
  db.rpc = async () => ({ data: true, error: null });
  const stored = [];
  db.storage = { from: () => ({ upload: async (p) => (stored.push(p), { error: null }), createSignedUrl: async (p) => ({ data: { signedUrl: "https://storage.test/" + p + "?sig=1" }, error: null }), remove: async (ps) => (ps.forEach((p) => stored.splice(stored.indexOf(p), 1)), { error: null }) }) };
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
  });
  const { encrypt } = load("src/lib/server/crypto.ts");
  tables.integration_connections ??= [{ id: "c1", workspace_id: "w1", provider: "instagram", status: "connected", provider_account_id: "1784", display_name: "@telepizza", scopes, encrypted_credentials: encrypt({ access_token: "IGTOKEN", obtained_at: Date.now() }, "w1:instagram"), expires_at: new Date(Date.now() + 30 * 86400000).toISOString(), metadata: {} }];
  return { db, tables, load, stored };
}

function graphMock(t, { failPublish = false } = {}) {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || "GET", body: init.body ? JSON.parse(init.body) : null });
    const u = String(url);
    const ok = (d) => new Response(JSON.stringify(d), { status: 200 });
    if (u.endsWith("/media") && init.method === "POST") return ok({ id: "container" + calls.length });
    if (u.includes("fields=status_code")) return ok({ status_code: "FINISHED" });
    if (u.endsWith("/media_publish")) return failPublish ? new Response(JSON.stringify({ error: { code: 10 } }), { status: 403 }) : ok({ id: "179900" });
    if (u.includes("fields=permalink")) return ok({ permalink: "https://www.instagram.com/p/abc/" });
    return new Response("{}", { status: 404 });
  });
  return calls;
}
const quiet = (t) => {
  t.mock.method(console, "info", () => {});
  t.mock.method(console, "error", () => {});
};

test("publish rules: caption limit, hashtags, images, formats and schedule window", async () => {
  const lib = serverLoader({})("src/lib/instagram-publish.ts");
  assert.deepEqual(lib.publishProblems(post()), []);
  assert.match(lib.publishProblems(post({ media: [] }))[0], /minstens één foto/);
  assert.ok(lib.publishProblems(post({ caption: "x".repeat(2200) })).some((p) => /2200/.test(p)), "hashtags count towards 2200");
  assert.ok(lib.publishProblems(post({ hashtags: Array.from({ length: 31 }, (_, i) => "#t" + i).join(" ") })).some((p) => /30 hashtags/.test(p)));
  assert.ok(lib.publishProblems(post({ contentType: "Reel" })).length);
  const now = new Date("2026-10-17T10:00:00");
  assert.deepEqual(lib.scheduleProblems("2026-10-17T12:00", now), []);
  assert.equal(lib.scheduleProblems("2026-10-17T10:02", now).length, 1);
  assert.equal(lib.scheduleProblems("2027-03-01T10:00", now).length, 1);
  assert.equal(lib.reallyPublished(post({ status: "published" })), false, "simulation is not a publication");
  assert.equal(lib.reallyPublished(post({ status: "published", instagram: { mediaId: "1", publishedAt: "x" } })), true);
});

test("Instagram: without the publish permission nothing is sent to Meta", async (t) => {
  quiet(t);
  const env = setup({ scopes: ["instagram_business_basic", "instagram_business_manage_messages"] });
  const calls = graphMock(t);
  const { publishPost, publishCapability } = env.load("src/lib/server/instagram-publish.ts");
  const cap = await publishCapability("w1");
  assert.equal(cap.code, "permission_missing");
  await assert.rejects(publishPost({ workspaceId: "w1", userId: "u1", trigger: "manual" }, "p1"), /toestemming om te publiceren/);
  assert.equal(calls.length, 0);
  assert.equal(env.tables.business_profiles[0].data.posts[0].status, "approved");
});

test("Instagram: publishes once through the official API, records media id, cleans temporary files, repeat is idempotent", async (t) => {
  quiet(t);
  const env = setup();
  const calls = graphMock(t);
  const { publishPost } = env.load("src/lib/server/instagram-publish.ts");
  const r = await publishPost({ workspaceId: "w1", userId: "u1", trigger: "manual" }, "p1");
  assert.equal(r.mediaId, "179900");
  const create = calls.find((c) => c.url.endsWith("/1784/media"));
  assert.match(create.url, /^https:\/\/graph\.instagram\.com\/v\d+\.\d+\/1784\/media$/);
  assert.equal(create.body.caption, "Ons herfstmenu\n\n#herfst");
  assert.match(create.body.image_url, /^https:\/\/storage\.test\/instagram-publish\/w1\//);
  const p = env.tables.business_profiles[0].data.posts[0];
  assert.equal(p.status, "published");
  assert.equal(p.instagram.mediaId, "179900");
  assert.equal(p.instagram.permalink, "https://www.instagram.com/p/abc/");
  assert.equal(env.stored.length, 0, "temporary copy removed");
  assert.equal(env.tables.instagram_publications[0].status, "published");
  const n = calls.length;
  const again = await publishPost({ workspaceId: "w1", userId: "u1", trigger: "manual" }, "p1");
  assert.equal(again.repeated, true);
  assert.equal(calls.length, n, "no second publication");
});

test("Instagram: an interrupted publication does not block the post forever and is never retried silently", async (t) => {
  quiet(t);
  const env = setup();
  const calls = graphMock(t);
  const { publishPost } = env.load("src/lib/server/instagram-publish.ts");
  const old = new Date(Date.now() - 3600000).toISOString();
  env.tables.instagram_publications.push({ id: "pub-stuck", workspace_id: "w1", post_id: "p1", status: "publishing", created_at: old, updated_at: old });
  // First click after the interruption: released with a warning, nothing sent to Meta.
  await assert.rejects(publishPost({ workspaceId: "w1", userId: "u1", trigger: "manual" }, "p1"), /onderbroken.*Controleer op Instagram/s);
  assert.equal(calls.length, 0);
  assert.equal(env.tables.instagram_publications[0].status, "failed");
  assert.match(env.tables.business_profiles[0].data.posts[0].failureReason, /Controleer op Instagram/);
  // The user checked and clicks again: now it publishes.
  assert.equal((await publishPost({ workspaceId: "w1", userId: "u1", trigger: "manual" }, "p1")).mediaId, "179900");
  // A publication that is still running is left alone.
  env.tables.instagram_publications.push({ id: "pub-live", workspace_id: "w1", post_id: "p9", status: "publishing", created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  await assert.rejects(publishPost({ workspaceId: "w1", userId: "u1", trigger: "manual" }, "p9"), /wordt al gepubliceerd/);
});

test("Instagram: drafts are refused, provider refusal leaves the post unpublished with a reason", async (t) => {
  quiet(t);
  const env = setup({ posts: [post(), post({ id: "p2", status: "draft" })] });
  graphMock(t, { failPublish: true });
  const { publishPost } = env.load("src/lib/server/instagram-publish.ts");
  await assert.rejects(publishPost({ workspaceId: "w1", userId: "u1", trigger: "manual" }, "p2"), /Keur de post eerst goed/);
  await assert.rejects(publishPost({ workspaceId: "w1", userId: "u1", trigger: "manual" }, "p1"), /\(nog\) niet toe om op dit account/);
  const p = env.tables.business_profiles[0].data.posts[0];
  assert.equal(p.status, "approved");
  assert.ok(p.failureReason);
  assert.equal(p.instagram, undefined);
  assert.equal(env.tables.instagram_publications[0].status, "failed");
});

test("publish route: members and missing confirmation are refused; workspace save cannot forge a publication", async (t) => {
  quiet(t);
  const member = setup({ user: "u2" });
  graphMock(t);
  const route = member.load("src/app/api/social/publish/route.ts");
  const req = (body) => new Request(origin + "/api/social/publish", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal((await route.POST(req({ postId: "p1", confirm: true }))).status, 403);
  const owner = setup();
  const r2 = owner.load("src/app/api/social/publish/route.ts");
  assert.equal((await r2.POST(req({ postId: "p1" }))).status, 400);
  const ws = owner.load("src/app/api/workspace/route.ts");
  const forged = structuredClone(owner.tables.business_profiles[0].data);
  forged.posts[0] = { ...forged.posts[0], status: "published", instagram: { mediaId: "1", publishedAt: "x" } };
  const res = await ws.PUT(new Request(origin + "/api/workspace", { method: "PUT", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ version: 3, data: forged }) }));
  assert.equal(res.status, 409);
});

test("e-mail audience: only consented subscribers, segments intersect, imported contacts never count", () => {
  const { campaignRecipients } = serverLoader({})("src/lib/email-send.ts");
  const consented = [{ subscriberId: "s1", email: "a@x.test", name: "An" }, { subscriberId: "s2", email: "B@x.test", name: "" }];
  const contacts = [{ email: "a@x.test", group: "Vaste klanten", status: "Ingeschreven" }, { email: "imported@x.test", group: "Vaste klanten", status: "Ingeschreven" }, { email: "b@x.test", group: "Nieuw", status: "Ingeschreven" }];
  const all = campaignRecipients("Nieuwsbriefabonnees", consented, contacts);
  assert.equal(all.recipients.length, 2);
  const vip = campaignRecipients("VIP klanten", consented, contacts);
  assert.deepEqual(vip.recipients.map((r) => r.subscriberId), ["s1"]);
  assert.equal(vip.withoutConsent, 1, "imported 'Ingeschreven' contact is left out and counted");
});

test("e-mail render: escaped content, unsubscribe link and reason, https images only", () => {
  const { renderCampaignEmail } = serverLoader({})("src/lib/email-send.ts");
  const m = renderCampaignEmail({ subject: "Hoi <b>", preview: "p", body: "Beste [voornaam],\n\n<script>x</script>", cta: "Reserveer", ctaUrl: "javascript:alert(1)", hero: "data:image/png;base64,AAA" }, { business: "Telepizza", address: "Amstelveen", unsubscribeUrl: "https://m.test/u?t=1", firstName: "An" });
  assert.ok(!m.html.includes("<script>"));
  assert.match(m.html, /Beste An/);
  assert.ok(!m.html.includes("javascript:"), "unsafe CTA dropped");
  assert.ok(!m.html.includes("data:image"), "data URL images are not sent");
  assert.match(m.html, /Afmelden/);
  assert.match(m.text, /Afmelden: https:\/\/m\.test\/u\?t=1/);
});

function mailEnv(t, { enabled = true, subscribers, suppressed = [] } = {}) {
  process.env.EMAIL_API_KEY = "re_fixture";
  process.env.EMAIL_MARKETING_FROM = "Telepizza <nieuws@mail.test>";
  if (enabled) process.env.EMAIL_MARKETING_ENABLED = "1";
  else delete process.env.EMAIL_MARKETING_ENABLED;
  const campaign = { id: "e1", title: "Herfst", kind: "Create Campaign", prompt: "", subject: "Herfstmenu", preview: "", sender: "Telepizza", audience: "Nieuwsbriefabonnees", body: "Beste [voornaam]", cta: "", ctaUrl: "", hero: "", footer: "", status: "approved", date: "", createdAt: "1", source: "manual", variant: 0, reason: "" };
  const env = setup({ tables: { newsletter_subscribers: subscribers || [{ id: "11111111-1111-4111-8111-111111111111", workspace_id: "w1", email: "an@x.test", email_normalized: "an@x.test", name: "An", status: "subscribed" }, { id: "22222222-2222-4222-8222-222222222222", workspace_id: "w1", email: "weg@x.test", email_normalized: "weg@x.test", name: "", status: "unsubscribed" }] } });
  env.tables.business_profiles[0].data.email.campaigns = [campaign];
  const { emailHash } = env.load("src/lib/server/newsletter.ts");
  env.tables.email_suppressions.push(...suppressed.map((e) => ({ workspace_id: "w1", email_hash: emailHash("w1", e), reason: "manual" })));
  const sent = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    const body = JSON.parse(init.body);
    sent.push({ url: String(url), body, key: init.headers["Idempotency-Key"] });
    return new Response(JSON.stringify(Array.isArray(body) ? { data: body.map((_, i) => ({ id: "msg_" + i })) } : { id: "msg_test" }), { status: 200 });
  });
  return { env, sent };
}

test("e-mail: real send is off without the switch; test e-mail goes only to the signed-in user", async (t) => {
  quiet(t);
  const { env, sent } = mailEnv(t, { enabled: false });
  const lib = env.load("src/lib/server/email-campaigns.ts");
  await assert.rejects(lib.sendCampaign({ workspaceId: "w1", userId: "u1", trigger: "manual" }, "e1"), /Testmails werken/);
  assert.equal(sent.length, 0);
  await lib.sendTest({ workspaceId: "w1", userId: "u1", email: "u1@example.test" }, "e1");
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].body.to, ["u1@example.test"]);
  assert.match(sent[0].body.subject, /^\[Test\]/);
});

test("e-mail: send reaches only consented, unsuppressed subscribers, once, with one-click unsubscribe and no stored addresses", async (t) => {
  quiet(t);
  const subscribers = [
    { id: "11111111-1111-4111-8111-111111111111", workspace_id: "w1", email: "an@x.test", name: "An Jansen", status: "subscribed" },
    { id: "33333333-3333-4333-8333-333333333333", workspace_id: "w1", email: "bounced@x.test", name: "", status: "subscribed" },
    { id: "22222222-2222-4222-8222-222222222222", workspace_id: "w1", email: "weg@x.test", name: "", status: "unsubscribed" },
  ];
  const { env, sent } = mailEnv(t, { subscribers, suppressed: ["bounced@x.test"] });
  const lib = env.load("src/lib/server/email-campaigns.ts");
  const r = await lib.sendCampaign({ workspaceId: "w1", userId: "u1", trigger: "manual" }, "e1");
  assert.equal(r.sent, 1);
  const batch = sent.find((s) => s.url.endsWith("/emails/batch")).body;
  assert.deepEqual(batch.map((m) => m.to[0]), ["an@x.test"]);
  assert.match(batch[0].headers["List-Unsubscribe"], /\/api\/newsletter\/unsubscribe\?token=/);
  assert.equal(batch[0].headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.match(batch[0].text, /Beste An/);
  assert.ok(!JSON.stringify(env.tables.email_deliveries).includes("@"), "no e-mail addresses stored");
  const c = env.tables.business_profiles[0].data.email.campaigns[0];
  assert.equal(c.status, "sent");
  assert.equal(c.delivery.recipients, 1);
  const n = sent.length;
  const again = await lib.sendCampaign({ workspaceId: "w1", userId: "u1", trigger: "manual" }, "e1");
  assert.equal(again.repeated, true);
  assert.equal(sent.length, n);
});

test("e-mail: a send interrupted half-way is closed honestly instead of blocking the campaign forever", async (t) => {
  quiet(t);
  const { env, sent } = mailEnv(t);
  const lib = env.load("src/lib/server/email-campaigns.ts");
  const old = new Date(Date.now() - 3600000).toISOString();
  env.tables.email_campaign_runs.push({ id: "run-stuck", workspace_id: "w1", campaign_id: "e1", kind: "send", status: "sending", recipients: 2, sent: 0, failed: 0, created_at: old, updated_at: old });
  env.tables.email_deliveries.push(
    { id: "d1", run_id: "run-stuck", workspace_id: "w1", email_hash: "h1", status: "sent", provider_message_id: "msg_a" },
    { id: "d2", run_id: "run-stuck", workspace_id: "w1", email_hash: "h2", status: "queued" },
  );
  const r = await lib.sendCampaign({ workspaceId: "w1", userId: "u1", trigger: "manual" }, "e1");
  assert.deepEqual([r.status, r.sent, r.repeated], ["partial", 1, true]);
  assert.equal(sent.length, 0, "nothing is sent again: no duplicate e-mails");
  const run = env.tables.email_campaign_runs.find((x) => x.id === "run-stuck");
  assert.deepEqual([run.status, run.sent, run.failed], ["partial", 1, 1]);
  assert.match(run.error, /onderbroken/);
  assert.equal(env.tables.email_deliveries.find((d) => d.id === "d2").status, "failed");
  // A send that is still running (recent heartbeat) is left alone.
  env.tables.email_campaign_runs.push({ id: "run-live", workspace_id: "w1", campaign_id: "e2", kind: "send", status: "sending", recipients: 1, sent: 0, failed: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  await assert.rejects(lib.sendCampaign({ workspaceId: "w1", userId: "u1", trigger: "manual" }, "e2"), /wordt al verstuurd/);
});

test("e-mail webhook: only valid signatures; bounces mark the delivery and suppress the address", async (t) => {
  quiet(t);
  const { env } = mailEnv(t);
  const lib = env.load("src/lib/server/email-campaigns.ts");
  await lib.sendCampaign({ workspaceId: "w1", userId: "u1", trigger: "manual" }, "e1");
  const secret = "whsec_" + randomBytes(24).toString("base64");
  const body = JSON.stringify({ type: "email.bounced", data: { email_id: "msg_0", to: ["an@x.test"] } });
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`m1.${ts}.${body}`).digest("base64");
  const h = new Headers({ "svix-id": "m1", "svix-timestamp": ts, "svix-signature": "v1," + sig });
  assert.equal(lib.verifyWebhook(h, body, secret), true);
  assert.equal(lib.verifyWebhook(h, body.replace("bounced", "delivered"), secret), false);
  assert.equal(lib.verifyWebhook(new Headers({ "svix-id": "m1", "svix-timestamp": "1", "svix-signature": "v1," + sig }), body, secret), false, "stale");
  await lib.applyWebhookEvent(JSON.parse(body));
  assert.equal(env.tables.email_deliveries[0].status, "bounced");
  assert.equal(env.tables.email_suppressions.length, 1);
});

test("automation model: preference vs permission vs running; Amsterdam time; due window; review safeguards", () => {
  const a = serverLoader({})("src/lib/automation.ts");
  const w = a.WORKFLOWS.find((x) => x.id === "instagram_publish_scheduled");
  const base = { preference: true, permitted: false, requirements: [{ label: "Koppeling", met: true }], pendingApprovals: 0, lastRun: null, recentFailures: 0 };
  assert.equal(a.workflowStatus(w, base).state, "preference_only");
  assert.equal(a.workflowStatus(w, { ...base, permitted: true, requirements: [{ label: "Koppeling", met: false }] }).state, "waiting");
  assert.equal(a.workflowStatus(w, { ...base, permitted: true }).operational, true);
  const rr = a.WORKFLOWS.find((x) => x.id === "review_auto_reply");
  assert.equal(a.workflowStatus(rr, { ...base, permitted: true }).operational, false, "designed, never running");
  assert.equal(new Date(a.amsterdamToUtc("2026-07-01T12:00")).toISOString(), "2026-07-01T10:00:00.000Z");
  assert.equal(new Date(a.amsterdamToUtc("2026-12-01T12:00")).toISOString(), "2026-12-01T11:00:00.000Z");
  const now = Date.parse("2026-12-01T11:30:00Z");
  const due = a.dueItems([{ status: "scheduled", date: "2026-12-01T12:00" }, { status: "scheduled", date: "2026-11-30T12:00" }, { status: "approved", date: "2026-12-01T12:00" }, { status: "scheduled", date: "2026-12-01T13:00" }], now);
  assert.equal(due.length, 1);
  const rules = { enabled: true, autoPublishMinRating: 4, manualBelowRating: 3 };
  assert.equal(a.replyDecision({ rating: 5, comment: "Heerlijk!", hasReply: false }, rules).action, "auto");
  assert.equal(a.replyDecision({ rating: 5, comment: "Lekker, maar ik werd ziek", hasReply: false }, rules).action, "manual");
  assert.equal(a.replyDecision({ rating: 1, comment: "", hasReply: false }, rules).action, "manual");
  assert.equal(a.replyDecision({ rating: 5, comment: "", hasReply: true }, rules).action, "skip");
});

test("automation: permission requires a working integration; review auto reply cannot be enabled; scheduler only acts with permission", async (t) => {
  quiet(t);
  process.env.CRON_SECRET = "cron-fixture-secret";
  const env = setup({ posts: [post({ status: "scheduled", date: new Date(Date.now() + 2 * 3600_000 - 60_000).toLocaleString("sv-SE", { timeZone: "Europe/Amsterdam" }).slice(0, 16).replace(" ", "T") })] });
  const calls = graphMock(t);
  const auto = env.load("src/lib/server/automation.ts");
  await assert.rejects(auto.setPermission({ workspaceId: "w1", userId: "u1" }, "review_auto_reply", true), /nog niet beschikbaar/);
  // Not yet due: nothing happens, with or without permission.
  await auto.runScheduled();
  assert.equal(calls.length, 0);
  // Due now, but no permission: nothing.
  env.tables.business_profiles[0].data.posts[0].date = new Date(Date.now() - 60_000).toLocaleString("sv-SE", { timeZone: "Europe/Amsterdam" }).slice(0, 16).replace(" ", "T");
  await auto.runScheduled();
  assert.equal(calls.length, 0);
  await auto.setPermission({ workspaceId: "w1", userId: "u1" }, "instagram_publish_scheduled", true);
  await auto.runScheduled();
  assert.equal(env.tables.business_profiles[0].data.posts[0].status, "published");
  assert.equal(env.tables.instagram_publications[0].trigger, "automation");
  assert.equal(env.tables.automation_runs[0].status, "ok");
  const cron = env.load("src/app/api/automation/cron/route.ts");
  assert.equal((await cron.POST(new Request(origin + "/api/automation/cron", { method: "POST" }))).status, 401);
  const status = await auto.automationStatus("w1");
  assert.equal(status.find((s) => s.id === "instagram_publish_scheduled").state, "running");
});

test("reviews: urgent first, monthly trend only from loaded data; calendar marks simulated publications", () => {
  const g = serverLoader({})("src/lib/reviews/google.ts");
  const r = (id, rating, createTime, reply = null) => ({ id, rating, comment: "", createTime, reply });
  const list = [r("a", 5, "2026-10-10T00:00:00Z"), r("b", 1, "2026-09-01T00:00:00Z"), r("c", 3, "2026-10-01T00:00:00Z"), r("d", 2, "2026-10-12T00:00:00Z", { comment: "x" })];
  assert.deepEqual(g.replyQueue(list).map((x) => x.id), ["b", "c", "a"]);
  assert.equal(g.loadedStats(list).urgent, 1);
  const trend = g.monthlyTrend(list, 6, new Date("2026-10-20T00:00:00Z"));
  assert.deepEqual(trend.map((m) => m.month), ["2026-09", "2026-10"], "no invented zero months before the data");
  assert.equal(trend[1].count, 3);
  const c = serverLoader({})("src/lib/calendar-data.ts");
  const items = c.toCalendarItems({ posts: [post({ status: "published" }), post({ id: "p2", status: "published", instagram: { mediaId: "1", publishedAt: "x" } })], email: { campaigns: [] } });
  assert.equal(c.statusMeta(items[0].status, items[0].simulated).label, "Gepubliceerd (simulatie)");
  assert.equal(c.statusMeta(items[1].status, items[1].simulated).label, "Gepubliceerd");
});
