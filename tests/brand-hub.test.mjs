import test from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace } from "../src/lib/storage.ts";
import {
  completion,
  defaultStrategy,
  stepErrors,
  strategyOf,
  strategyValid,
} from "../src/lib/brand-strategy.ts";
import { buildBrandContext } from "../src/lib/ai/brand-context.ts";
import { buildEmailInstruction } from "../src/lib/ai/email-instruction.ts";
import { buildInstagramInstruction } from "../src/lib/ai/instagram-instruction.ts";
import { serverLoader } from "./helpers/server-loader.mjs";

const profile = () => ({
  ...structuredClone(emptyWorkspace.profile),
  name: "Studio",
  industry: "Ontwerp",
  description: "Een ontwerpstudio voor lokale ondernemers.",
  audience: "Ondernemers",
  voice: "Eigen bestaande toon",
  strategy: {
    ...structuredClone(defaultStrategy),
    tonePreset: "luxe",
    language: "fr",
    objective: "binding",
    ctas: ["Plan een afspraak"],
  },
});

test("legacy profiles retain their custom voice and require no new preset", () => {
  const p = profile();
  delete p.strategy;
  assert.deepEqual(stepErrors(2, p), {});
  assert.equal(buildBrandContext(p).toneOfVoice, "Eigen bestaande toon");
  assert.equal(strategyOf(p).language, "nl");
  assert.equal(p.strategy, undefined);
});

test("completion and validation support optional fields and actionable errors", () => {
  const p = profile();
  assert.deepEqual(stepErrors(1, p), {});
  assert.deepEqual(stepErrors(3, p), {});
  assert.deepEqual(stepErrors(4, p), {});
  p.website = "javascript:alert(1)";
  assert.ok(stepErrors(1, p).website);
  const c = completion(p);
  assert.equal(c.perStep.length, 4);
  assert.ok(c.percent >= 0 && c.percent <= 100);
});

test("strategy rejects unknown choices, oversized drafts and active images", () => {
  const s = profile().strategy;
  assert.equal(strategyValid(s), true);
  for (const patch of [
    { language: "invalid" },
    { objective: "unknown" },
    { usps: "x".repeat(2001) },
    { completedSteps: [0] },
    { referenceImages: ["data:image/svg+xml;base64,PHN2Zz4="] },
  ]) {
    assert.equal(strategyValid({ ...s, ...patch }), false);
  }
});

test("AI context carries marketing defaults while excluding private profile data", () => {
  const p = {
    ...profile(),
    products: "Logo ontwerp",
    contentPreferences: "Praktische tips",
    phone: "PRIVATE_PHONE",
    address: "PRIVATE_ADDRESS",
    vatNumber: "PRIVATE_VAT",
    logo: "PRIVATE_IMAGE",
  };
  const b = buildBrandContext(p);
  assert.equal(b.language, "Frans");
  assert.match(b.toneOfVoice, /Luxe/);
  assert.equal(b.productDescription, "Logo ontwerp");
  assert.equal(b.contentPreferences, "Praktische tips");
  assert.doesNotMatch(JSON.stringify(b), /PRIVATE_/);
});

test("Instagram and email use brand CTA defaults but respect explicit overrides", () => {
  const p = profile();
  const input = {
    profile: p,
    prompt: "Nieuws",
    type: "Post",
    goal: "merkbekendheid",
    kind: "Create Newsletter",
    audience: "Iedereen",
    useWebsite: false,
  };
  for (const build of [buildInstagramInstruction, buildEmailInstruction]) {
    assert.equal(build(input).cta, "Plan een afspraak");
    assert.equal(build({ ...input, cta: "Lees verder" }).cta, "Lees verder");
  }
  assert.equal(
    buildEmailInstruction({ ...input, tone: "Eigen berichttoon" }).tone,
    "Eigen berichttoon",
  );
});

test("server asset validation checks MIME signatures and preserves existing hosted assets", () => {
  const { brandAssetsValid, rasterImageValid, brandProfileSchema } =
    serverLoader({})("src/lib/server/brand-validation.ts");
  assert.equal(
    rasterImageValid(
      "data:image/png;base64," +
        Buffer.from("<script>alert(1)</script>").toString("base64"),
      1000,
    ),
    false,
  );
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLXkAAAAASUVORK5CYII=";
  assert.equal(rasterImageValid(png, 1000), true);
  assert.equal(rasterImageValid(png, 20), false);
  assert.equal(
    brandAssetsValid(
      { logo: "https://example.com/logo.png" },
      { logo: "https://example.com/logo.png" },
    ),
    true,
  );
  assert.equal(
    brandAssetsValid({ logo: "https://other.test/new.png" }, {}),
    false,
  );
  assert.equal(
    brandProfileSchema.safeParse({ ...profile(), audience: {} }).success,
    false,
  );
  assert.equal(brandProfileSchema.safeParse(profile()).success, true);
});

test("tone preview requires authorization and strips private fields before generation", async () => {
  let denied = false,
    received;
  class HttpError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  }
  const route = serverLoader({
    "@/lib/server/access": {
      HttpError,
      sameOrigin: () => {},
      limited: async () => {},
      workspace: async (roles) => {
        assert.deepEqual(roles, ["OWNER", "ADMIN"]);
        if (denied) throw new HttpError(403, "Geen toegang");
        return { user: { id: "u" }, workspaceId: "w" };
      },
      failure: (e) =>
        Response.json({ error: e.message }, { status: e.status || 503 }),
    },
    "@/lib/server/ai": {
      generateTonePreview: async (p) => {
        received = p;
        return { instagram: "Voorbeeld", email: "Nieuws" };
      },
    },
  })("src/app/api/brand/preview/route.ts");
  const request = (body) =>
    new Request("https://mavix.test/api/brand/preview", {
      method: "POST",
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await route.POST(
        request({ ...profile(), phone: "private", vatNumber: "private" }),
      )
    ).status,
    200,
  );
  assert.equal(received.phone, undefined);
  assert.equal(received.vatNumber, undefined);
  assert.equal(
    (await route.POST(request({ name: "x".repeat(161) }))).status,
    400,
  );
  denied = true;
  assert.equal((await route.POST(request(profile()))).status, 403);
});
