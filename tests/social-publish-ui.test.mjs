import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { publishStatusText } from "../src/lib/instagram-publish.ts";
import { instagramGoals, normalizeGoal, plannedGoal, isInstagramGoal } from "../src/lib/ai/instagram-instruction.ts";
import { buildImagePrompt } from "../src/lib/image-prompt.ts";
import { settingsError, defaultInstagram } from "../src/lib/instagram-model.ts";

// Social: the publishing status follows the real capability (no fixed "not
// connected" text); the create flow is three steps with one brief; images
// are branded (the business's own photos as references).

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

test("create flow: two kinds (post, carousel), three numbered steps, one brief, no square/portrait choice, no separate image brief", () => {
  const create = fs.readFileSync("src/components/instagram/create.tsx", "utf8");
  const kinds = create.match(/const KINDS[\s\S]*?\];/)[0];
  assert.deepEqual([...kinds.matchAll(/id: "([^"]+)"/g)].map((m) => m[1]), ["Post", "Carousel"]);
  assert.match(create, /t === "Image" \|\| t === "Captions & Hashtags" \? "Post"/, "older Image / caption concepts open as a Post");
  for (const step of ["Wat maak je?", "Doel van deze post", "Wat wil je delen?"]) assert.ok(create.includes(step), step);
  assert.equal((create.match(/id="ig-prompt"/g) || []).length, 1, "exactly one brief input");
  assert.doesNotMatch(create, /Vierkant|Staand \(4:5\)|imageFormat/);
  assert.doesNotMatch(create, /ig-image-brief|Meer beeldopties|Wat moet er op de afbeelding staan/);
  assert.match(create, /GlowBorder/, "the brief has the Mavix light on focus");
});

test("branded images: the business's own photos are the references; without them Mavix makes no AI image", () => {
  const create = fs.readFileSync("src/components/instagram/create.tsx", "utf8");
  assert.match(create, /referenceKind: "brand"/);
  assert.match(create, /references: brandPhotos/);
  assert.match(create, /autoApplies = AUTO_IMAGE_TYPES\.includes\(type\) && brandPhotos\.length > 0/);
  assert.match(create, /Voeg eerst 1 tot 3 foto(&apos;|')s van je zaak toe/);
  const prompt = buildImagePrompt({ brief: "onze pizza margherita", mode: "inspire", format: "square", references: 2, referenceKind: "brand" });
  assert.match(prompt, /of this exact business/);
  assert.match(prompt, /Do not invent other products/);
  assert.doesNotMatch(prompt, /only as visual inspiration/);
  const loose = buildImagePrompt({ brief: "x", mode: "inspire", format: "square", references: 1, referenceKind: "inspiration" });
  assert.match(loose, /only as visual inspiration/);
});

test("goals: seven clear goals, older ids keep working, and the weekly plan gives each day its own goal", () => {
  assert.equal(instagramGoals.length, 7);
  assert.ok(instagramGoals.every((g) => g.label && g.hint));
  assert.equal(normalizeGoal("merkbekendheid"), "bekendheid");
  assert.equal(normalizeGoal("product-promotie"), "product");
  assert.equal(normalizeGoal("testimonial"), "review");
  assert.equal(normalizeGoal("onzin"), "bekendheid");
  assert.equal(isInstagramGoal("educatief"), true);
  // 2026-11-16 is a Monday, 2026-11-20 a Friday.
  const plan = { 1: "bekendheid", 5: "aanbieding" };
  assert.equal(plannedGoal(plan, "2026-11-16T18:00"), "bekendheid");
  assert.equal(plannedGoal(plan, "2026-11-20"), "aanbieding");
  assert.equal(plannedGoal(plan, "2026-11-18T12:00"), undefined, "no goal for Wednesday");
  assert.equal(plannedGoal(undefined, "2026-11-16"), undefined);
  assert.equal(settingsError({ ...defaultInstagram, goalPlan: { 1: "bekendheid", 5: "aanbieding" } }), "");
  assert.equal(settingsError({ ...defaultInstagram, goalPlan: { 9: "bekendheid" } }), "Ongeldig weekplan.");
});

test("AI actions in the editor are locked synchronously against double clicks", () => {
  const create = fs.readFileSync("src/components/instagram/create.tsx", "utf8");
  for (const fn of ["generate", "regenerateImageOnly", "editImage", "edit"]) {
    const body = create.match(new RegExp("async function " + fn + "\\([\\s\\S]*?\\r?\\n  }\\r?\\n"))[0];
    assert.match(body, /lockAi\(\)/, fn + " takes the lock");
    assert.match(body, /finally \{\s*aiLock\.current = false;/, fn + " releases the lock");
  }
});
