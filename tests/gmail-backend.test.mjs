import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";
const origin = "https://mavix.webbo-solutions.nl";
const callback = origin + "/api/integrations/gmail/callback";
const fixtureMessage = (id = "m1", over = {}) => ({
  id,
  threadId: "t1",
  internalDate: "1791374400000",
  labelIds: ["INBOX", "UNREAD"],
  snippet: "Hello",
  payload: {
    mimeType: "text/plain",
    headers: [
      { name: "From", value: "Customer <customer@example.com>" },
      { name: "To", value: "owner@example.com" },
      { name: "Subject", value: "Reservation" },
      { name: "Message-ID", value: "<" + id + "@example.com>" },
      { name: "Reply-To", value: "reply@example.com" },
    ],
    body: { data: Buffer.from("Hello").toString("base64url") },
  },
  ...over,
});
function setup(t) {
  process.env.GOOGLE_CLIENT_ID = "client-fixture";
  process.env.GOOGLE_CLIENT_SECRET = "secret-fixture";
  process.env.OAUTH_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  const tables = {
    workspace_members: [{ user_id: "u1", workspace_id: "w1", role: "OWNER" }],
    workspaces: [{ id: "w1", deleted_at: null }],
    integration_connections: [],
    oauth_states: [],
  };
  const db = memoryDb(tables),
    jar = new Map(),
    state = { user: { id: "u1" } },
    requests = [];
  db.auth = {
    getUser: async () => ({ data: { user: state.user }, error: null }),
  };
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: {
      adminClient: () => db,
      authClient: async () => db,
      appUrl: () => origin,
    },
    "next/headers": {
      cookies: async () => ({
        get: (n) => jar.get(n),
        set: (n, value, options) => jar.set(n, { value, options }),
        delete: (n) => jar.delete(n),
      }),
    },
  });
  const oauth = load("src/app/api/integrations/[provider]/[action]/route.ts"),
    creds = load("src/lib/server/gmail-credentials.ts"),
    crypto = load("src/lib/server/crypto.ts");
  const reply = (data, status = 200) =>
    new Response(JSON.stringify(data), { status });
  const token = (over = {}) => ({
    access_token: "access-fixture",
    refresh_token: "refresh-fixture",
    expires_in: 3600,
    scope: creds.GMAIL_SCOPES.join(" "),
    ...over,
  });
  const network = {
    handle: async (url, init) => {
      if (url.includes("/token")) return reply(token());
      if (url.includes("/userinfo"))
        return reply({
          sub: "account1",
          email: "owner@example.com",
          email_verified: true,
        });
      if (url.includes("/threads?"))
        return reply({ threads: [{ id: "t1" }], nextPageToken: "next-page" });
      if (url.includes("/threads/t1"))
        return reply({ id: "t1", messages: [fixtureMessage()] });
      if (url.endsWith("/messages/send"))
        return reply({ id: "sent1", threadId: "t1" });
      throw Error("Unexpected fixture request " + url);
    },
  };
  t.mock.method(globalThis, "fetch", async (url, init = {}) => {
    requests.push({ url: String(url), init });
    return network.handle(String(url), init);
  });
  const request = (url, method = "GET", body) =>
    new Request(origin + url, {
      method,
      headers: { origin, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const action = (name, method = "GET", query = "") =>
    oauth[method](request("/api/integrations/gmail/" + name + query, method), {
      params: Promise.resolve({ provider: "gmail", action: name }),
    });
  const start = async () => {
    const res = await action("connect", "POST");
    assert.equal(res.status, 200);
    return new URL((await res.json()).url);
  };
  const complete = (url) =>
    action(
      "callback",
      "GET",
      "?code=fixture-code&state=" + url.searchParams.get("state"),
    );
  const connect = async () => {
    assert.equal((await complete(await start())).status, 307);
    return tables.integration_connections[0];
  };
  return {
    tables,
    db,
    jar,
    state,
    requests,
    load,
    creds,
    crypto,
    reply,
    token,
    network,
    request,
    action,
    start,
    complete,
    connect,
  };
}
test("Gmail OAuth requests only Gmail scopes, PKCE, offline access and explicit consent", async (t) => {
  const f = setup(t),
    url = await f.start();
  assert.equal(url.searchParams.get("redirect_uri"), callback);
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.deepEqual(
    new Set(url.searchParams.get("scope").split(" ")),
    new Set(f.creds.GMAIL_SCOPES),
  );
  assert.equal(f.jar.get("mavix_oauth_gmail").options.httpOnly, true);
});
test("callback stores encrypted credentials and safe status; state cannot be replayed", async (t) => {
  const f = setup(t),
    url = await f.start();
  assert.equal((await f.complete(url)).status, 307);
  const c = f.tables.integration_connections[0];
  assert.ok(!c.encrypted_credentials.includes("access-fixture"));
  assert.equal(
    f.crypto.decrypt(c.encrypted_credentials, "w1:gmail").refresh_token,
    "refresh-fixture",
  );
  assert.throws(() => f.crypto.decrypt(c.encrypted_credentials, "w2:gmail"));
  assert.throws(() =>
    f.crypto.decrypt(c.encrypted_credentials, "w1:google_calendar"),
  );
  // Replayed state: back to Integraties with a friendly notice, never JSON.
  const replay = await f.complete(url);
  assert.equal(replay.status, 307);
  assert.match(replay.headers.get("location"), /\/account\/integraties\?error=expired&provider=gmail$/);
  assert.equal(f.tables.integration_connections[0].provider_account_id, "account1");
  const status = await (await f.action("status")).json();
  assert.equal(status.accountEmail, "owner@example.com");
  assert.equal(status.connected, true);
  assert.ok(!JSON.stringify(status).includes("credentials"));
});
test("missing read scope cannot connect; offline refresh token is mandatory", async (t) => {
  const f = setup(t);
  f.network.handle = async () =>
    f.reply(
      f.token({
        scope: "openid email https://www.googleapis.com/auth/gmail.send",
      }),
    );
  const res = await f.complete(await f.start());
  assert.equal(res.status, 307);
  assert.match(res.headers.get("location"), /error=permission&provider=gmail$/);
  assert.notEqual(f.tables.integration_connections[0].status, "connected");
  assert.equal(f.tables.integration_connections[0].encrypted_credentials, undefined);
  const original = setup;
  assert.ok(original);
});
test("repeat consent preserves refresh token only for the same account", async (t) => {
  const f = setup(t);
  await f.connect();
  const base = f.network.handle;
  f.network.handle = (url, init) =>
    url.includes("/token")
      ? f.reply(f.token({ refresh_token: undefined }))
      : base(url, init);
  assert.equal((await f.complete(await f.start())).status, 307);
  assert.equal(
    f.crypto.decrypt(
      f.tables.integration_connections[0].encrypted_credentials,
      "w1:gmail",
    ).refresh_token,
    "refresh-fixture",
  );
  f.network.handle = (url, init) =>
    url.includes("/userinfo")
      ? f.reply({
          sub: "other",
          email: "other@example.com",
          email_verified: true,
        })
      : url.includes("/token")
        ? f.reply(f.token({ refresh_token: undefined }))
        : base(url, init);
  const res = await f.complete(await f.start());
  assert.match(res.headers.get("location"), /offline_access/);
  assert.equal(
    f.tables.integration_connections[0].provider_account_id,
    "account1",
  );
});
test("refresh preserves omitted refresh token and does not touch Calendar", async (t) => {
  const f = setup(t),
    c = await f.connect();
  f.tables.integration_connections.push({
    id: "cal",
    workspace_id: "w1",
    provider: "google_calendar",
    status: "connected",
    encrypted_credentials: "calendar-fixture",
  });
  c.expires_at = new Date(0).toISOString();
  f.network.handle = async () =>
    f.reply(f.token({ access_token: "new-access", refresh_token: undefined }));
  assert.equal(
    (await f.creds.gmailToken("w1")).token.refresh_token,
    "refresh-fixture",
  );
  assert.equal(
    f.crypto.decrypt(c.encrypted_credentials, "w1:gmail").access_token,
    "new-access",
  );
  assert.equal(
    f.tables.integration_connections[1].encrypted_credentials,
    "calendar-fixture",
  );
});
test("invalid_grant requires reconnect; network, quota and server failures preserve connection", async (t) => {
  for (const kind of ["revoked", "network", "quota", "server"]) {
    const f = setup(t),
      c = await f.connect();
    c.expires_at = new Date(0).toISOString();
    f.network.handle = async () => {
      if (kind === "network") throw Error("private-details");
      return f.reply(
        { error: kind === "revoked" ? "invalid_grant" : "temporary" },
        kind === "revoked" ? 400 : kind === "quota" ? 429 : 500,
      );
    };
    await assert.rejects(f.creds.gmailToken("w1"));
    assert.equal(
      c.status,
      kind === "revoked" ? "reconnect_required" : "connected",
    );
    t.mock.restoreAll();
  }
});
test("disconnect blocks late callback and late refresh; does not revoke Google grants", async (t) => {
  const f = setup(t),
    c = await f.connect(),
    url = await f.start();
  c.expires_at = new Date(0).toISOString();
  f.network.handle = async () => {
    assert.equal((await f.action("disconnect", "POST")).status, 200);
    return f.reply(f.token());
  };
  await assert.rejects(f.creds.gmailToken("w1"));
  assert.equal(c.encrypted_credentials, null);
  const late = await f.complete(url);
  assert.match(late.headers.get("location"), /error=expired&provider=gmail$/);
  assert.equal(c.encrypted_credentials, null);
  assert.equal(c.status, "disconnected");
  assert.ok(!f.requests.some((r) => r.url.includes("/revoke")));
});
test("foreign workspace cookie, unauthenticated session and member connect are rejected before provider calls", async (t) => {
  const f = setup(t);
  f.jar.set("mavix-workspace", { value: "w2" });
  assert.equal((await f.action("status")).status, 403);
  f.jar.clear();
  f.state.user = null;
  assert.equal((await f.action("status")).status, 401);
  f.state.user = { id: "u1" };
  f.tables.workspace_members[0].role = "MEMBER";
  assert.equal((await f.action("connect", "POST")).status, 403);
  assert.equal(f.requests.length, 0);
});
test("list threads uses Gmail search and cursor and safe normalized summaries", async (t) => {
  const f = setup(t);
  await f.connect();
  const api = f.load("src/app/api/inbox/gmail/threads/route.ts");
  const res = await api.GET(
    f.request(
      "/api/inbox/gmail/threads?q=from%3Acustomer%40example.com&pageToken=cursor&pageSize=25",
    ),
  );
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.conversations[0].channel, "gmail");
  assert.equal(data.conversations[0].unread, true);
  assert.equal(data.nextPageToken, "next-page");
  assert.equal(data.conversations[0].messages, undefined);
  const call = f.requests.find((r) => r.url.includes("/threads?"));
  assert.equal(new URL(call.url).searchParams.get("pageToken"), "cursor");
  assert.equal(
    new URL(call.url).searchParams.get("q"),
    "from:customer@example.com",
  );
});
test("thread details normalize sender, To, CC and full plain text without exposing HTML", async (t) => {
  const f = setup(t);
  await f.connect();
  const api = f.load("src/app/api/inbox/gmail/threads/[threadId]/route.ts");
  const res = await api.GET(f.request("/"), {
    params: Promise.resolve({ threadId: "t1" }),
  });
  const { thread } = await res.json();
  assert.equal(thread.messageCount, 1);
  assert.equal(thread.messages[0].body, "Hello");
  assert.equal(thread.messages[0].recipients[0].email, "owner@example.com");
  assert.equal(thread.messages[0].html, undefined);
});
test("new mail validates addresses and prevents CRLF header injection before send", async (t) => {
  const f = setup(t);
  await f.connect();
  const api = f.load("src/app/api/inbox/gmail/send/route.ts");
  for (const input of [
    { to: "bad", subject: "test", body: "hello" },
    {
      to: "ok@example.com",
      subject: "x\r\nBcc: victim@example.com",
      body: "hello",
    },
  ])
    assert.equal((await api.POST(f.request("/", "POST", input))).status, 400);
  const res = await api.POST(
    f.request("/", "POST", {
      to: "ok@example.com",
      subject: "Café",
      body: "Hello",
    }),
  );
  assert.equal(res.status, 200);
  const sent = f.requests.find((r) => r.url.endsWith("/messages/send"));
  const raw = Buffer.from(
    JSON.parse(sent.init.body).raw,
    "base64url",
  ).toString();
  assert.match(raw, /To: ok@example.com/);
  assert.match(raw, /Subject: =\?UTF-8\?B\?/);
});
test("reply uses actual thread, Reply-To, Message-ID, References and matching subject", async (t) => {
  const f = setup(t);
  await f.connect();
  const api = f.load(
    "src/app/api/inbox/gmail/threads/[threadId]/reply/route.ts",
  );
  const res = await api.POST(f.request("/", "POST", { body: "Thanks" }), {
    params: Promise.resolve({ threadId: "t1" }),
  });
  assert.equal(res.status, 200);
  const send = JSON.parse(
    f.requests.find((r) => r.url.endsWith("/messages/send")).init.body,
  );
  assert.equal(send.threadId, "t1");
  const raw = Buffer.from(send.raw, "base64url").toString();
  assert.match(raw, /To: reply@example.com/);
  assert.match(raw, /In-Reply-To: <m1@example.com>/);
  assert.match(raw, /References: <m1@example.com>/);
  assert.match(raw, /Subject: Re: Reservation/);
});
test("old account records cannot be replied to using a newly connected account", async (t) => {
  const f = setup(t);
  await f.connect();
  const api = f.load("src/lib/server/gmail.ts");
  const count = f.requests.length;
  await assert.rejects(
    api.replyGmailThread("w1", "t1", "Hello", "different-account"),
    (e) => e.status === 409,
  );
  assert.equal(f.requests.length, count);
});
test("Gmail 401 refreshes once, 403 permissions require consent, quota remains connected", async (t) => {
  const f = setup(t),
    c = await f.connect(),
    api = f.load("src/lib/server/gmail-api.ts");
  let failures = 0;
  f.network.handle = async (url) =>
    url.includes("/token")
      ? f.reply(f.token({ access_token: "refreshed" }))
      : failures++ === 0
        ? f.reply({}, 401)
        : f.reply({ id: "t1" });
  assert.equal((await api.gmailRequest("w1", "/threads/t1")).id, "t1");
  assert.equal(c.status, "connected");
  f.network.handle = async () =>
    f.reply({ error: { errors: [{ reason: "rateLimitExceeded" }] } }, 403);
  await assert.rejects(
    api.gmailRequest("w1", "/threads/t1"),
    (e) => e.status === 429,
  );
  assert.equal(c.status, "connected");
  f.network.handle = async () =>
    f.reply(
      { error: { errors: [{ reason: "insufficientPermissions" }] } },
      403,
    );
  await assert.rejects(
    api.gmailRequest("w1", "/threads/t1"),
    (e) => e.status === 403,
  );
  assert.equal(c.status, "permission_missing");
});
test("network send failure is not retried and reports ambiguity without provider internals", async (t) => {
  const f = setup(t);
  await f.connect();
  let count = 0;
  f.network.handle = async () => {
    count++;
    throw Error("secret-token");
  };
  const api = f.load("src/lib/server/gmail.ts");
  await assert.rejects(
    api.sendNewGmail("w1", {
      to: "to@example.com",
      subject: "Hi",
      body: "Hello",
    }),
    (e) =>
      e.status === 503 &&
      /Verzonden/.test(e.message) &&
      !e.message.includes("secret-token"),
  );
  assert.equal(count, 1);
});
function syncFixture(f,cursor='10') {
 const row={workspace_id:'w1',provider:'gmail',provider_account_id:'account1',cursor,last_synced_at:null};f.tables.inbox_sync_state=[row];
 f.db.rpc=async(name,p)=>{if(name==='claim_gmail_sync'){if(row.lease_owner)return {data:false,error:null};row.lease_owner=p.p_owner;}return {data:true,error:null};};return row;
}
test('incremental sync imports more than 100 references without dropping them and resumes history pagination',async t=>{
 const f=setup(t);await f.connect();const state=syncFixture(f),inbox=f.load('src/lib/server/inbox.ts');let page=0;
 f.network.handle=async url=>{
  if(url.includes('/history?')){page++;return f.reply(page===1?{historyId:'900',nextPageToken:'page2',history:[{messagesAdded:Array.from({length:105},(_,i)=>({message:{id:'m'+i,threadId:'t1',labelIds:['INBOX']}}))}]}:{historyId:'901',history:[]});}
  if(url.includes('/messages/'))return f.reply(fixtureMessage(new URL(url).pathname.split('/').at(-1)));
  throw Error('Unexpected sync fixture');
 };
 assert.equal((await inbox.syncGmail('w1',true)).imported,105);
 assert.equal(f.tables.inbox_messages.length,105);assert.deepEqual(JSON.parse(state.cursor),{start:'10',page:'page2'});assert.equal(state.lease_owner,null);
 await inbox.syncGmail('w1',true);assert.equal(state.cursor,'901');assert.ok(f.requests.some(r=>r.url.includes('pageToken=page2')));
});
test('sync failure retains cursor, releases lease; busy sync does not contact Google',async t=>{const f=setup(t);await f.connect();const state=syncFixture(f),inbox=f.load('src/lib/server/inbox.ts');state.lease_owner='other';const before=f.requests.length;assert.equal((await inbox.syncGmail('w1',true)).status,'busy');assert.equal(f.requests.length,before);state.lease_owner=null;f.network.handle=async()=>f.reply({},500);await assert.rejects(inbox.syncGmail('w1',true));assert.equal(state.cursor,'10');assert.equal(state.lease_owner,null);});
test('expired history cursor uses bounded recent-mail bootstrap',async t=>{const f=setup(t);await f.connect();const state=syncFixture(f),inbox=f.load('src/lib/server/inbox.ts');f.network.handle=async url=>url.includes('/history?')?f.reply({},404):url.endsWith('/profile')?f.reply({historyId:'222'}):f.reply({messages:[]});await inbox.syncGmail('w1',true);assert.equal(state.cursor,'222');const list=f.requests.find(r=>r.url.includes('/messages?'));assert.equal(new URL(list.url).searchParams.get('maxResults'),'50');assert.match(new URL(list.url).searchParams.get('q'),/newer_than:30d/);});
test('missing offline access and denied consent never create a connected mailbox',async t=>{const f=setup(t),base=f.network.handle;f.network.handle=(url,init)=>url.includes('/token')?f.reply(f.token({refresh_token:undefined})):base(url,init);const res=await f.complete(await f.start());assert.match(res.headers.get('location'),/offline_access/);assert.equal(f.tables.integration_connections[0].status,'disconnected');const url=await f.start();const denied=await f.action('callback','GET','?error=access_denied&state='+url.searchParams.get('state'));assert.match(denied.headers.get('location'),/error=denied/);assert.equal(f.tables.oauth_states.length,0);});
test('Gmail connection missing read scope blocks API calls before network access',async t=>{const f=setup(t),c=await f.connect();c.scopes=['https://www.googleapis.com/auth/gmail.send'];const count=f.requests.length;await assert.rejects(f.creds.gmailToken('w1'),e=>e.status===403);assert.equal(f.requests.length,count);assert.equal(c.status,'permission_missing');});
test('authenticated attachment proxy rejects old mailbox data and foreign workspaces',async t=>{const f=setup(t);await f.connect();const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';f.tables.inbox_messages=[{id,workspace_id:'w1',provider:'gmail',provider_account_id:'old-account',provider_message_id:'m1',attachments:[{name:'file.pdf',ref:'a1',mimeType:'application/pdf'}]}];const inbox=f.load('src/lib/server/inbox.ts');await assert.rejects(inbox.attachment('w1',id,0),e=>e.status===409);await assert.rejects(inbox.attachment('w2',id,0),e=>e.status===404);});
test('MIME body attachment is retrieved server-side; nested HTML is converted to plain text',async t=>{const f=setup(t);await f.connect();const msg=fixtureMessage();msg.payload.mimeType='multipart/mixed';delete msg.payload.body;msg.payload.parts=[{mimeType:'multipart/alternative',parts:[{mimeType:'text/html',body:{attachmentId:'body1',size:100}}]},{mimeType:'application/pdf',filename:'test.pdf',body:{attachmentId:'file1',size:500}}];f.network.handle=async url=>url.includes('/attachments/body1')?f.reply({data:Buffer.from('<script>bad()</script><p>Good<br>mail</p><img src="https://tracker.invalid/a">').toString('base64url')}):f.reply({id:'t1',messages:[msg]});const gmail=f.load('src/lib/server/gmail.ts');const thread=await gmail.getGmailThread('w1','t1');assert.equal(thread.messages[0].body,'Good\nmail');assert.equal(thread.messages[0].attachments[0].attachmentId,'file1');assert.ok(!f.requests.some(r=>r.url.includes('tracker.invalid')));});
test('successful sends are cached in the unified Inbox, not a Gmail-only database',async t=>{const f=setup(t);await f.connect();const gmail=f.load('src/lib/server/gmail.ts');const sent=await gmail.sendNewGmail('w1',{to:'customer@example.com',subject:'Hi',body:'Hello'});assert.equal(sent.status,'sent');assert.equal(sent.inboxSynced,true);assert.equal(f.tables.inbox_conversations[0].provider,'gmail');assert.equal(f.tables.inbox_messages[0].workspace_id,'w1');});
test("conversations from a disconnected or previous Gmail account are hidden, not deleted", async (t) => {
  const f = setup(t);
  const c = await f.connect();
  const id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  f.tables.inbox_conversations = [
    { id, workspace_id: "w1", provider: "gmail", provider_account_id: "old-account", provider_thread_id: "t9", external_contact: {}, subject: "Oud", status: "open", unread_count: 0, labels: [] },
  ];
  f.tables.inbox_messages = [];
  const inbox = f.load("src/lib/server/inbox.ts");
  assert.equal(await inbox.visibleGmailAccount("w1"), "account1");
  await assert.rejects(inbox.getConversation("w1", id), (e) => e.status === 404);
  f.tables.inbox_conversations[0].provider_account_id = "account1";
  assert.equal((await inbox.getConversation("w1", id)).conversation.subject, "Oud");
  assert.equal((await f.action("disconnect", "POST")).status, 200);
  assert.equal(c.provider_account_id, null);
  assert.equal(await inbox.visibleGmailAccount("w1"), null);
  await assert.rejects(inbox.getConversation("w1", id), (e) => e.status === 404);
  assert.equal(f.tables.inbox_conversations.length, 1, "cached rows are kept, only hidden");
  assert.equal(f.tables.inbox_sync_state.length, 0, "sync cursor is cleared on disconnect");
});
test("Meer laden imports one bounded page via nextPageToken, remembers it and releases the lease", async (t) => {
  const f = setup(t);
  const c = await f.connect();
  const state = syncFixture(f);
  const inbox = f.load("src/lib/server/inbox.ts");
  const lists = [];
  f.network.handle = async (url) => {
    if (url.includes("/messages?")) {
      const u = new URL(url);
      lists.push(u.searchParams.get("pageToken") || "");
      assert.equal(u.searchParams.get("maxResults"), "50");
      assert.doesNotMatch(u.searchParams.get("q"), /newer_than/);
      return lists.length === 1
        ? f.reply({ messages: [{ id: "old1", threadId: "t5", labelIds: ["INBOX"] }], nextPageToken: "p2" })
        : f.reply({ messages: [] });
    }
    if (url.includes("/messages/")) return f.reply(fixtureMessage("old1", { threadId: "t5" }));
    throw Error("Unexpected backfill fixture " + url);
  };
  const first = await inbox.backfillGmail("w1");
  assert.deepEqual([first.imported, first.done], [1, false]);
  assert.deepEqual(c.metadata.backfill, { pageToken: "p2", done: false });
  assert.equal(state.lease_owner, null);
  const second = await inbox.backfillGmail("w1");
  assert.equal(second.done, true);
  assert.deepEqual(lists, ["", "p2"]);
  const count = f.requests.length;
  assert.equal((await inbox.backfillGmail("w1")).status, "done");
  assert.equal(f.requests.length, count, "a finished backfill does not call Google again");
});
test("new e-mail returns the Inbox conversation so the UI can open it", async (t) => {
  const f = setup(t);
  await f.connect();
  const gmail = f.load("src/lib/server/gmail.ts");
  const sent = await gmail.sendNewGmail("w1", { to: "customer@example.com", subject: "Hi", body: "Hello" });
  assert.equal(sent.conversationId, f.tables.inbox_conversations[0].id);
});
