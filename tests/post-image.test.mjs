import test from "node:test";
import assert from "node:assert/strict";
import { generateWithImage, regenerateImage, linkedImage, wantsAutoImage, replaceLinked, imageBrief } from "../src/lib/post-image.ts";

// One prompt creates caption + matching image; the AI image is linked to the
// concept so regenerating replaces it, while own photos always win.
// Image generation is mocked: no paid requests.

const concept = (over = {}) => ({ id: "gen-" + Math.random(), prompt: "Meme Italiaans restaurant Amstelveen", caption: "Pasta > maandag", hashtags: "#pasta", status: "draft", date: "", createdAt: "2026-10-24T10:00:00.000Z", variant: 0, contentType: "Post", ...over });

function deps({ failImage = false, failSave = false } = {}) {
  const saved = [];
  const briefs = [];
  let n = 0;
  return {
    saved,
    briefs,
    text: async () => concept({ caption: "Caption " + ++n }),
    image: async (brief) => {
      briefs.push(brief);
      if (failImage) throw new Error("Beeldgeneratie is tijdelijk niet beschikbaar.");
      return "mavix-media:ai-" + briefs.length;
    },
    persist: async (p) => (failSave ? false : (saved.push(structuredClone(p)), true)),
  };
}

test("a prompt generates caption and matching image together, from the same prompt", async () => {
  const d = deps();
  const seen = [];
  const r = await generateWithImage({ ...d, prompt: "Maak een humoristische Instagram-meme voor een Italiaans restaurant in Amstelveen", type: "Post", auto: true, current: { post: null, media: [] }, onText: (p, coming) => seen.push([p.caption, coming]) });
  assert.deepEqual(seen, [["Caption 1", true]], "the caption is shown first, with the image announced as coming");
  assert.equal(r.image.state, "done");
  assert.deepEqual(r.media, ["mavix-media:ai-1"]);
  assert.equal(r.post.aiImage, "mavix-media:ai-1");
  assert.match(d.briefs[0], /humoristische Instagram-meme voor een Italiaans restaurant in Amstelveen/);
  // Saved twice: the text right away, then text + image (same concept).
  assert.equal(d.saved.length, 2);
  assert.equal(d.saved[1].id, d.saved[0].id);
  assert.deepEqual(d.saved[1].media, ["mavix-media:ai-1"]);
  assert.equal(d.saved[1].caption, "Caption 1");
});

test("the image matches the format: a beeldpost leaves room for text, a post is one clear image", () => {
  assert.match(imageBrief("Herfstmenu", "Image"), /beeldpost.*korte tekst/s);
  assert.match(imageBrief("Herfstmenu", "Post"), /één helder beeld/);
  assert.equal(wantsAutoImage({ type: "Carousel", auto: true, media: [] }), false, "carousels use their own slide studio");
  assert.equal(wantsAutoImage({ type: "Captions & Hashtags", auto: true, media: [] }), false);
  assert.equal(wantsAutoImage({ type: "Post", auto: false, media: [] }), false, "the user can switch it off");
});

test("Opnieuw genereren replaces both text and the linked image, on the same concept", async () => {
  const d = deps();
  const first = await generateWithImage({ ...d, prompt: "p", type: "Post", auto: true, current: { post: null, media: [] } });
  const again = await generateWithImage({ ...d, prompt: "p", type: "Post", auto: true, current: { post: first.post, media: first.media } });
  assert.equal(again.post.id, first.post.id, "no second concept");
  assert.equal(again.post.caption, "Caption 2");
  assert.deepEqual(again.media, ["mavix-media:ai-2"], "old AI image replaced, not stacked");
  assert.equal(again.post.aiImage, "mavix-media:ai-2");
});

test("editing only the caption keeps the image; 'Alleen afbeelding opnieuw' changes only the image", async () => {
  const d = deps();
  const first = await generateWithImage({ ...d, prompt: "p", type: "Post", auto: true, current: { post: null, media: [] } });
  const edited = { ...first.post, caption: "Mijn eigen caption" };
  const r = await regenerateImage({ ...d, prompt: "p", type: "Post", post: edited, media: first.media });
  assert.equal(r.post.caption, "Mijn eigen caption", "text untouched");
  assert.deepEqual(r.media, ["mavix-media:ai-2"]);
});

test("own photos override the automatic image and are never replaced by regenerating", async () => {
  const d = deps();
  const first = await generateWithImage({ ...d, prompt: "p", type: "Post", auto: true, current: { post: null, media: [] } });
  // The user uploads an own photo (replaces the selection).
  const own = ["mavix-media:own-1"];
  assert.equal(linkedImage(first.post, own), undefined, "the AI image is no longer selected");
  const again = await generateWithImage({ ...d, prompt: "p", type: "Post", auto: true, current: { post: first.post, media: own } });
  assert.deepEqual(again.media, own, "own photo kept");
  assert.equal(again.image.state, "none", "no image generated over an own photo");
  assert.equal(d.briefs.length, 1);
  // An own photo next to the AI image: regenerating the image keeps the own photo.
  assert.deepEqual(replaceLinked(["mavix-media:ai-1", "mavix-media:own-1"], "mavix-media:ai-1", "mavix-media:ai-9"), ["mavix-media:ai-9", "mavix-media:own-1"]);
});

test("removing the image leaves no selected image; the next generation makes a new one", async () => {
  const d = deps();
  const first = await generateWithImage({ ...d, prompt: "p", type: "Post", auto: true, current: { post: null, media: [] } });
  const removed = [];
  assert.equal(linkedImage(first.post, removed), undefined);
  const again = await generateWithImage({ ...d, prompt: "p", type: "Post", auto: true, current: { post: first.post, media: removed } });
  assert.deepEqual(again.media, ["mavix-media:ai-2"]);
});

test("a failed image keeps the saved text and the previous image, and reports a retryable error", async () => {
  const ok = deps();
  const first = await generateWithImage({ ...ok, prompt: "p", type: "Post", auto: true, current: { post: null, media: [] } });
  const failing = deps({ failImage: true });
  const r = await generateWithImage({ ...failing, prompt: "p", type: "Post", auto: true, current: { post: first.post, media: first.media } });
  assert.equal(r.image.state, "error");
  assert.match(r.image.message, /niet beschikbaar/);
  assert.deepEqual(r.media, first.media, "previous image not lost");
  assert.equal(failing.saved.length, 1, "the new text was saved");
  // Retry works with the same concept.
  const retry = await regenerateImage({ ...ok, prompt: "p", type: "Post", post: r.post, media: r.media });
  assert.equal(retry.image.state, "done");
});

test("the saved draft contains the generated image, so it is there after a reload", async () => {
  const d = deps();
  const r = await generateWithImage({ ...d, prompt: "p", type: "Image", auto: true, current: { post: null, media: [] } });
  const stored = d.saved.at(-1);
  assert.deepEqual([stored.media, stored.aiImage], [r.media, r.post.aiImage]);
  // What the workspace keeps after a reload is what the editor shows.
  const reloaded = JSON.parse(JSON.stringify(stored));
  assert.equal(linkedImage(reloaded, reloaded.media), "mavix-media:ai-1");
});

test("a failed text save stops before any image is generated", async () => {
  const d = deps({ failSave: true });
  await assert.rejects(generateWithImage({ ...d, prompt: "p", type: "Post", auto: true, current: { post: null, media: [] } }), /niet worden opgeslagen/);
  assert.equal(d.briefs.length, 0, "no paid image for an unsaved concept");
});
