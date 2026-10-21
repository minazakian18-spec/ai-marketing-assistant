import test from "node:test";
import assert from "node:assert/strict";
import { defaultChannel, CHANNEL_ORDER } from "../src/lib/inbox/channel-default.ts";

const ch = (states) => Object.entries(states).map(([channel, state]) => ({ channel, state }));

test("channel-first Inbox: always one channel, never an aggregate view", () => {
  assert.deepEqual(CHANNEL_ORDER, ["instagram", "whatsapp", "gmail", "messenger"]);
  for (const c of [[], ch({ gmail: "reconnect" }), ch({ whatsapp: "connected" })]) assert.ok(CHANNEL_ORDER.includes(defaultChannel(c, {}, null)));
});

test("the last choice wins while it is still connected", () => {
  const channels = ch({ instagram: "connected", gmail: "connected" });
  assert.equal(defaultChannel(channels, { instagram: 5 }, "gmail"), "gmail");
  // A remembered channel that is no longer connected does not trap the user.
  assert.equal(defaultChannel(ch({ instagram: "connected", gmail: "reconnect" }), {}, "gmail"), "instagram");
  // Garbage in storage is ignored.
  assert.equal(defaultChannel(channels, {}, "alle"), "instagram");
});

test("otherwise the connected channel with the most unread, ties in the usual order", () => {
  const channels = ch({ instagram: "connected", whatsapp: "connected", gmail: "connected" });
  assert.equal(defaultChannel(channels, { gmail: 3, whatsapp: 1 }, null), "gmail");
  assert.equal(defaultChannel(channels, { whatsapp: 2, gmail: 2 }, null), "whatsapp");
  assert.equal(defaultChannel(channels, {}, null), "instagram");
});

test("nothing connected: a channel that needs attention, then the last choice, then Instagram", () => {
  assert.equal(defaultChannel(ch({ instagram: "not_connected", gmail: "reconnect" }), {}, null), "gmail");
  assert.equal(defaultChannel([], {}, "messenger"), "messenger");
  assert.equal(defaultChannel([], {}, null), "instagram");
});
