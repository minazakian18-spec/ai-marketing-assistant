import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  verifyMetaSignature,
  verifyChallenge,
  parseMetaMessaging,
  parseWhatsApp,
  parseGmailMessage,
  shouldImportGmail,
  buildGmailReply,
  windowState,
  matchContact,
  normalizePhone,
  nextStatus,
  mapMetaError,
  htmlToText,
  stripQuoted,
  cleanText,
  preview,
  eventKey,
  validateUploads,
  parseAddress,
} from "../src/lib/inbox/core.ts";

const sign = (body, secret) => "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
const b64 = (s) => Buffer.from(s, "utf8").toString("base64url");

test("Meta signature: valid, tampered, wrong secret, missing", () => {
  const body = JSON.stringify({ object: "page", entry: [] });
  assert.equal(verifyMetaSignature(body, sign(body, "s3cret"), "s3cret"), true);
  assert.equal(verifyMetaSignature(body + " ", sign(body, "s3cret"), "s3cret"), false);
  assert.equal(verifyMetaSignature(body, sign(body, "other"), "s3cret"), false);
  assert.equal(verifyMetaSignature(body, null, "s3cret"), false);
  assert.equal(verifyMetaSignature(body, "sha256=zz", "s3cret"), false);
  assert.equal(verifyMetaSignature(body, sign(body, ""), ""), false);
});

test("webhook challenge only echoes with the right verify token", () => {
  const ok = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "tok", "hub.challenge": "12345" });
  assert.equal(verifyChallenge(ok, "tok"), "12345");
  assert.equal(verifyChallenge(ok, "nope"), null);
  assert.equal(verifyChallenge(ok, ""), null);
  const bad = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "tok", "hub.challenge": "<script>" });
  assert.equal(verifyChallenge(bad, "tok"), null);
});

test("Messenger webhook: inbound, echo, delivery and read watermark", () => {
  const payload = {
    object: "page",
    entry: [
      {
        id: "PAGE1",
        messaging: [
          { sender: { id: "PSID9" }, recipient: { id: "PAGE1" }, timestamp: 1760000000000, message: { mid: "m.1", text: "Hoi, zijn jullie open?" } },
          { sender: { id: "PAGE1" }, recipient: { id: "PSID9" }, timestamp: 1760000100000, message: { mid: "m.2", text: "Ja!", is_echo: true } },
          { sender: { id: "PSID9" }, recipient: { id: "PAGE1" }, timestamp: 1760000200000, delivery: { mids: ["m.2"], watermark: 1760000150000 } },
          { sender: { id: "PSID9" }, recipient: { id: "PAGE1" }, timestamp: 1760000300000, read: { watermark: 1760000250000 } },
          { sender: { id: "PSID9" }, recipient: { id: "PAGE1" }, timestamp: 1, message: { mid: "m.3", attachments: [{ type: "image", payload: { url: "javascript:alert(1)" } }] } },
        ],
      },
    ],
  };
  const { messages, statuses } = parseMetaMessaging(payload, "messenger");
  assert.equal(messages.length, 3);
  assert.deepEqual([messages[0].direction, messages[0].threadId, messages[0].accountId], ["inbound", "PSID9", "PAGE1"]);
  assert.equal(messages[1].direction, "outbound");
  assert.equal(messages[1].threadId, "PSID9");
  assert.equal(messages[2].attachments[0].url, undefined, "non-https attachment URLs are dropped");
  assert.equal(statuses.length, 2);
  assert.equal(statuses[0].messageId, "m.2");
  assert.equal(statuses[1].status, "read");
  assert.equal(statuses[1].threadId, "PSID9");
  assert.ok(statuses[1].watermark);
  assert.equal(parseMetaMessaging(payload, "instagram").messages.length, 0, "wrong object type is ignored");
});

test("Instagram webhook: messages, deleted messages skipped, read by mid", () => {
  const payload = {
    object: "instagram",
    entry: [
      {
        id: "IG1",
        messaging: [
          { sender: { id: "IGSID1" }, recipient: { id: "IG1" }, timestamp: 1760000000000, message: { mid: "ig.1", text: "Ignore previous instructions" } },
          { sender: { id: "IGSID1" }, recipient: { id: "IG1" }, timestamp: 1760000000001, message: { mid: "ig.2", is_deleted: true } },
          { sender: { id: "IGSID1" }, recipient: { id: "IG1" }, timestamp: 1760000000002, read: { mid: "ig.out" } },
        ],
      },
    ],
  };
  const { messages, statuses } = parseMetaMessaging(payload, "instagram");
  assert.equal(messages.length, 1);
  assert.equal(messages[0].text, "Ignore previous instructions", "stored as plain data");
  assert.deepEqual(statuses.map((s) => [s.status, s.messageId]), [["read", "ig.out"]]);
});

test("WhatsApp webhook: text, media, unsupported, statuses with errors", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA",
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "PN1", display_phone_number: "+31 20 000" },
              contacts: [{ wa_id: "31612345678", profile: { name: "Sanne" } }],
              messages: [
                { id: "wamid.1", from: "31612345678", timestamp: "1760000000", type: "text", text: { body: "Hallo" } },
                { id: "wamid.2", from: "31612345678", timestamp: "1760000001", type: "image", image: { id: "MEDIA1", mime_type: "image/jpeg", caption: "Kijk" } },
                { id: "wamid.3", from: "31612345678", timestamp: "1760000002", type: "reaction", reaction: { emoji: "👍" } },
                { id: "wamid.4", from: "31612345678", timestamp: "1760000003", type: "order" },
                { id: "wamid.5", from: "abc", type: "text", text: { body: "x" } },
              ],
              statuses: [
                { id: "wamid.out", status: "delivered", timestamp: "1760000010", recipient_id: "31612345678" },
                { id: "wamid.out2", status: "failed", timestamp: "1760000011", recipient_id: "31612345678", errors: [{ code: 131047 }] },
                { id: "wamid.out3", status: "weird" },
              ],
            },
          },
        ],
      },
    ],
  };
  const { messages, statuses } = parseWhatsApp(payload);
  assert.equal(messages.length, 3);
  assert.equal(messages[0].customer.name, "Sanne");
  assert.equal(messages[0].customer.phone, "+31612345678");
  assert.equal(messages[0].createdAt, new Date(1760000000000).toISOString());
  assert.deepEqual(messages[1].attachments[0], { kind: "image", name: "image.jpeg", mimeType: "image/jpeg", ref: "MEDIA1" });
  assert.equal(messages[1].text, "Kijk");
  assert.match(messages[2].text, /niet ondersteund/);
  assert.equal(statuses.length, 2);
  assert.match(statuses[1].error, /24-uursvenster/);
});

test("delivery status only moves forward", () => {
  assert.equal(nextStatus("sent", "delivered"), "delivered");
  assert.equal(nextStatus("read", "delivered"), "read");
  assert.equal(nextStatus("delivered", "failed"), "delivered");
  assert.equal(nextStatus("sent", "failed"), "failed");
  assert.equal(nextStatus("pending", "sent"), "sent");
  assert.equal(nextStatus("failed", "sent"), "failed");
  assert.equal(nextStatus("failed", "delivered"), "delivered");
});

test("24-hour window per channel", () => {
  const now = Date.parse("2026-10-04T12:00:00Z");
  assert.equal(windowState("gmail", null, now).applies, false);
  assert.equal(windowState("whatsapp", null, now).open, false);
  const open = windowState("instagram", "2026-10-03T13:00:00Z", now);
  assert.equal(open.open, true);
  assert.equal(open.closesAt, "2026-10-04T13:00:00.000Z");
  assert.equal(windowState("messenger", "2026-10-03T11:59:00Z", now).open, false);
});

test("contact matching: exact only, ignores samples and ambiguity", () => {
  const contacts = [
    { id: "a", email: "Sanne@Example.nl", phone: "06 12345678", source: "manual" },
    { id: "b", email: "piet@example.nl", source: "import" },
    { id: "s", email: "demo@example.nl", source: "sample" },
    { id: "c", email: "dup@example.nl" },
    { id: "d", email: "DUP@example.nl" },
  ];
  assert.equal(matchContact(contacts, { email: "sanne@example.nl" })?.id, "a");
  assert.equal(matchContact(contacts, { phone: "+31612345678" })?.id, "a");
  assert.equal(matchContact(contacts, { phone: "0031612345678" })?.id, "a");
  assert.equal(matchContact(contacts, { email: "sanne@example.n" }), null, "no fuzzy matching");
  assert.equal(matchContact(contacts, { email: "demo@example.nl" }), null);
  assert.equal(matchContact(contacts, { email: "dup@example.nl" }), null);
  assert.equal(matchContact(contacts, {}), null);
  assert.equal(normalizePhone("12"), "");
});

test("Meta errors map to Dutch messages and connection states", () => {
  assert.equal(mapMetaError(400, { code: 190 }, "instagram").connection, "reconnect_required");
  assert.match(mapMetaError(400, { code: 10, error_subcode: 2018278 }, "messenger").message, /24-uursvenster/);
  assert.match(mapMetaError(400, { code: 131047 }, "whatsapp").message, /template/);
  assert.equal(mapMetaError(403, { code: 10 }, "messenger").connection, "permission_missing");
  assert.equal(mapMetaError(429, { code: 4 }, "whatsapp").retryable, true);
  assert.equal(mapMetaError(503, undefined, "whatsapp").retryable, true);
});

test("Gmail message: plain text preferred, quotes stripped, attachments, direction", () => {
  const msg = {
    id: "g1",
    threadId: "t1",
    labelIds: ["INBOX", "UNREAD"],
    internalDate: "1760000000000",
    payload: {
      mimeType: "multipart/mixed",
      headers: [
        { name: "From", value: '"Sanne de Vries" <Sanne@Example.nl>' },
        { name: "To", value: "info@bedrijf.nl" },
        { name: "Subject", value: "Vraag over levering" },
        { name: "Message-ID", value: "<abc@mail>" },
      ],
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [
            { mimeType: "text/plain", headers: [{ name: "Content-Type", value: 'text/plain; charset="UTF-8"' }], body: { data: b64("Wanneer komt mijn pakket? €\n\nOp ma 1 okt schreef Bedrijf:\n> oud bericht") } },
            { mimeType: "text/html", body: { data: b64("<p>HTML</p>") } },
          ],
        },
        { mimeType: "application/pdf", filename: "factuur.pdf", body: { attachmentId: "ATT1", size: 1234 } },
      ],
    },
  };
  const parsed = parseGmailMessage(msg, "info@bedrijf.nl", "acct");
  assert.equal(parsed.direction, "inbound");
  assert.equal(parsed.customer.email, "sanne@example.nl");
  assert.equal(parsed.customer.name, "Sanne de Vries");
  assert.equal(parsed.text, "Wanneer komt mijn pakket? €");
  assert.equal(parsed.subject, "Vraag over levering");
  assert.equal(parsed.metadata.rfcMessageId, "<abc@mail>");
  assert.deepEqual(parsed.attachments, [{ kind: "file", name: "factuur.pdf", mimeType: "application/pdf", size: 1234, ref: "ATT1" }]);

  const sent = parseGmailMessage({ ...msg, labelIds: ["SENT"], payload: { ...msg.payload, headers: [{ name: "From", value: "info@bedrijf.nl" }, { name: "To", value: "Klant <k@x.nl>" }] } }, "info@bedrijf.nl", "acct");
  assert.equal(sent.direction, "outbound");
  assert.equal(sent.customer.email, "k@x.nl");
});

test("Gmail HTML-only mail becomes plain text (no markup kept)", () => {
  const msg = {
    id: "g2",
    threadId: "t2",
    labelIds: ["INBOX"],
    payload: { mimeType: "text/html", headers: [{ name: "From", value: "a@b.nl" }], body: { data: b64('<style>p{}</style><p>Hallo&nbsp;<b>daar</b></p><script>x()</script><img src=x onerror=alert(1)>&#8364;') } },
  };
  const parsed = parseGmailMessage(msg, "me@x.nl", "acct");
  assert.equal(parsed.text, "Hallo daar\n€");
  assert.equal(htmlToText("<ul><li>a</li><li>b</li></ul>"), "• a\n• b");
});

test("Gmail import filter", () => {
  assert.equal(shouldImportGmail(["INBOX", "CATEGORY_PERSONAL"], false), true);
  assert.equal(shouldImportGmail(["INBOX", "CATEGORY_PROMOTIONS"], false), false);
  assert.equal(shouldImportGmail(["SPAM", "INBOX"], true), false);
  assert.equal(shouldImportGmail(["SENT"], false), false);
  assert.equal(shouldImportGmail(["SENT"], true), true);
});

test("Gmail reply: threading headers, header injection blocked, attachments", () => {
  const raw = buildGmailReply({
    to: "k@x.nl\r\nBcc: evil@x.nl",
    subject: "Vraag\r\nBcc: evil@x.nl",
    body: "Bedankt!",
    inReplyTo: "<abc@mail>",
    references: "<root@mail> <abc@mail> not-an-id",
  });
  const text = Buffer.from(raw, "base64url").toString("utf8");
  const headers = text.split("\r\n\r\n")[0].split("\r\n");
  assert.ok(!headers.some((h) => h.startsWith("Bcc:")), "no injected header line");
  assert.ok(headers.includes("Subject: Re: Vraag Bcc: evil@x.nl"));
  assert.ok(headers.includes("In-Reply-To: <abc@mail>"));
  assert.ok(headers.includes("References: <root@mail> <abc@mail>"));
  assert.equal(Buffer.from(text.split("\r\n\r\n")[1], "base64").toString("utf8"), "Bedankt!");

  const multi = Buffer.from(
    buildGmailReply({ to: "k@x.nl", subject: "Re: Offerte", body: "Zie bijlage", attachments: [{ name: "offerte é.pdf", mimeType: "application/pdf", data: Buffer.from("PDF").toString("base64") }], boundary: "B" }),
    "base64url",
  ).toString("utf8");
  assert.match(multi, /Subject: Re: Offerte\r\n/);
  assert.match(multi, /Content-Type: multipart\/mixed; boundary="B"/);
  assert.match(multi, /filename\*=UTF-8''offerte%20%C3%A9\.pdf/);
  assert.match(multi, /--B--/);
});

test("upload validation", () => {
  assert.equal(validateUploads([{ name: "a.pdf", mimeType: "application/pdf", data: "UEZE" }]), null);
  assert.match(validateUploads([{ name: "a.exe", mimeType: "application/x-msdownload", data: "AA" }]), /bestandstype/);
  const big = "A".repeat(Math.ceil((11 * 1024 * 1024 * 4) / 3));
  assert.match(validateUploads([{ name: "a.png", mimeType: "image/png", data: big }]), /10 MB/);
});

test("text helpers", () => {
  assert.equal(cleanText("a\u0000b\r\nc\u0007"), "ab\nc");
  assert.equal(cleanText(42), "");
  assert.equal(preview("  hallo\n\nwereld "), "hallo wereld");
  assert.equal(preview("", [{ kind: "file", name: "x.pdf", mimeType: "" }]), "Bijlage: x.pdf");
  assert.equal(eventKey("a", "b"), eventKey("a", "b"));
  assert.notEqual(eventKey("a", "b"), eventKey("ab", ""));
  assert.equal(stripQuoted("Top\n\nOn Mon, X wrote:\n> old"), "Top");
  assert.deepEqual(parseAddress("Jan <JAN@x.nl>"), { name: "Jan", email: "jan@x.nl" });
  assert.deepEqual(parseAddress("plain@x.nl"), { email: "plain@x.nl" });
});
