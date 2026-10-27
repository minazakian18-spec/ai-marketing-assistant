import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { publishStatusText } from "../src/lib/instagram-publish.ts";

// Social: the publishing status follows the real capability (no fixed "not
// connected" text), a post is always image + caption, and refinements are
// folded away.

test("the Social header says where publishing really stands", () => {
  assert.equal(publishStatusText({ ready: true, code: "ready", message: "", account: "telepizza.amstelveen" }), "Publiceren naar @telepizza.amstelveen staat klaar");
  assert.equal(publishStatusText({ ready: false, code: "not_connected", message: "" }), "Instagram is nog niet gekoppeld");
  assert.equal(publishStatusText({ ready: false, code: "permission_missing", message: "" }), "Instagram gekoppeld, publiceren wacht op toestemming van Meta");
  assert.equal(publishStatusText({ ready: false, code: "demo", message: "" }), "Testmodus: er wordt niets gepubliceerd");
  assert.equal(publishStatusText(null), "Instagram-status laden…");
});

test("no fixed 'not available / not connected' publishing texts are left in the editor or the header", () => {
  const create = fs.readFileSync("src/components/instagram/create.tsx", "utf8");
  const workspace = fs.readFileSync("src/components/instagram/workspace.tsx", "utf8");
  assert.doesNotMatch(create, /Publiceren naar Instagram vanuit Mavix is nog niet beschikbaar/);
  assert.doesNotMatch(workspace, /<small>Publiceren naar Instagram is nog niet gekoppeld<\/small>/);
  assert.match(create, /<InstagramPublishPanel capability=\{publishCap\} \/>/);
  assert.match(create, /<PublishButton post=/, "approved concepts can be published from the editor");
});

test("formats: Post covers image + caption; no separate 'Afbeelding' or caption-only format; old concepts still open", () => {
  const create = fs.readFileSync("src/components/instagram/create.tsx", "utf8");
  const formats = create.match(/const FORMATS[\s\S]*?\];/)[0];
  assert.deepEqual([...formats.matchAll(/id: "([^"]+)"/g)].map((m) => m[1]), ["Post", "Carousel", "Content Ideas"]);
  assert.match(create, /t === "Image" \|\| t === "Captions & Hashtags" \? "Post"/, "older Image / caption concepts open as a Post");
});

test("the briefing is the image brief; extra image and post settings are folded under 'Meer opties'", () => {
  const create = fs.readFileSync("src/components/instagram/create.tsx", "utf8");
  assert.doesNotMatch(create, /Wat moet er op de afbeelding staan\?/);
  assert.match(create, /<summary>Meer opties<\/summary>/);
  assert.match(create, /<summary>Meer beeldopties<\/summary>[\s\S]*ig-image-brief/);
});

test("AI actions in the editor are locked synchronously against double clicks", () => {
  const create = fs.readFileSync("src/components/instagram/create.tsx", "utf8");
  for (const fn of ["generate", "regenerateImageOnly", "makeImage", "editImage", "edit"]) {
    const body = create.match(new RegExp("async function " + fn + "\\([\\s\\S]*?\\r?\\n  }\\r?\\n"))[0];
    assert.match(body, /lockAi\(\)/, fn + " takes the lock");
    assert.match(body, /finally \{\s*aiLock\.current = false;/, fn + " releases the lock");
  }
});
