import test from "node:test";
import assert from "node:assert/strict";
import { generateMock } from "../src/lib/content-generator.ts";
import {
  emptyWorkspace,
  readWorkspace,
  writeWorkspace,
  STORAGE_KEY,
} from "../src/lib/storage.ts";

test("mockgeneratie gebruikt het idee en de bedrijfsnaam, met een nieuwe conceptidentiteit", () => {
  const profile = { ...emptyWorkspace.profile, name: "Studio Bloom" };
  const first = generateMock("Onze weekendactie", profile);
  const second = generateMock("Onze weekendactie", profile, 1);
  assert.match(first.caption, /Studio Bloom/);
  assert.match(first.caption, /Onze weekendactie/);
  assert.equal(first.status, "draft");
  assert.equal(first.date, "");
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.caption, second.caption);
  assert.match(first.hashtags, /#StudioBloom/);
});

test("lokale opslag begint leeg en bewaart profiel, status en planning", () => {
  const memory = new Map();
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
  assert.deepEqual(readWorkspace(), emptyWorkspace);
  const profile = { ...emptyWorkspace.profile, name: "Mijn bedrijf" };
  const post = {
    ...generateMock("Een nieuw product", profile),
    status: "scheduled",
    date: "2027-01-15T12:00",
  };
  const workspace = {
    ...structuredClone(emptyWorkspace),
    profile,
    posts: [post],
  };
  writeWorkspace(workspace);
  assert.deepEqual(readWorkspace(), workspace);
  memory.set(STORAGE_KEY, "{broken");
  assert.throws(() => readWorkspace());
  memory.set(
    STORAGE_KEY,
    JSON.stringify({ profile, posts: [{ status: "published" }] }),
  );
  assert.throws(() => readWorkspace(), /Ongeldige/);
  globalThis.localStorage.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  assert.throws(() => writeWorkspace(workspace), /QuotaExceededError/);
});

test("bestaande MVP-opslag migreert zonder profiel of posts te verliezen", () => {
  const legacy = {
    profile: {
      name: "Bestaand bedrijf",
      industry: "Retail",
      audience: "Klanten",
      description: "Een winkel",
      voice: "Warm",
    },
    posts: [generateMock("Weekendactie", emptyWorkspace.profile)],
  };
  const memory = new Map([[STORAGE_KEY, JSON.stringify(legacy)]]);
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
  const migrated = readWorkspace();
  assert.equal(migrated.profile.name, legacy.profile.name);
  assert.equal(migrated.profile.industry, legacy.profile.industry);
  assert.deepEqual(migrated.posts, legacy.posts);
  assert.deepEqual(migrated.account, emptyWorkspace.account);
  assert.equal(migrated.profile.vatNumber, "");
  assert.deepEqual(migrated.notifications, emptyWorkspace.notifications);
  assert.equal("name" in migrated.account, false);
  assert.equal("industry" in migrated.account, false);
  // Merely loading the new UI does not overwrite the existing stored version.
  assert.equal(memory.get(STORAGE_KEY), JSON.stringify(legacy));
});
test("oude Full Autopilot-instellingen migreren naar Auto Create met een toestemming-toggle", async () => {
  const { defaultInstagram } = await import("../src/lib/instagram-model.ts");
  const { defaultEmail } = await import("../src/lib/email-model.ts");
  const memory = new Map();
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
  const legacyInstagram = { ...defaultInstagram, mode: "full", enabled: true };
  delete legacyInstagram.requireApproval;
  const legacyEmailSettings = { ...defaultEmail, mode: "auto", enabled: true };
  delete legacyEmailSettings.requireApproval;
  memory.set(
    STORAGE_KEY,
    JSON.stringify({
      ...emptyWorkspace,
      instagram: legacyInstagram,
      email: { settings: legacyEmailSettings, campaigns: [] },
    }),
  );
  const migrated = readWorkspace();
  assert.equal(migrated.instagram.mode, "auto");
  assert.equal(migrated.instagram.requireApproval, false);
  assert.equal(migrated.email.settings.mode, "auto");
  // Old Auto Create always required approval, so a missing flag defaults to true.
  assert.equal(migrated.email.settings.requireApproval, true);
});
test("contacten migreren met voorbeelddata en valideren nieuwe/gewijzigde gegevens", async () => {
  const { contactValid } = await import("../src/lib/contact-data.ts");
  const memory = new Map();
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
  const legacy = {
    profile: emptyWorkspace.profile,
    posts: [],
  };
  memory.set(STORAGE_KEY, JSON.stringify(legacy));
  const migrated = readWorkspace();
  assert.equal(migrated.contacts.length, emptyWorkspace.contacts.length);
  assert.ok(migrated.contacts.every(contactValid));
  const withContact = {
    ...structuredClone(emptyWorkspace),
    contacts: [
      {
        id: "c1",
        firstName: "Test",
        lastName: "Persoon",
        email: "test@example.test",
        status: "Ingeschreven",
        source: "manual",
        createdAt: new Date().toISOString(),
      },
    ],
  };
  writeWorkspace(withContact);
  assert.deepEqual(readWorkspace().contacts, withContact.contacts);
  memory.set(
    STORAGE_KEY,
    JSON.stringify({
      ...withContact,
      contacts: [{ ...withContact.contacts[0], email: "geen-emailadres" }],
    }),
  );
  assert.throws(() => readWorkspace(), /Ongeldige contactgegevens/);
});
test("account, meldingen en integraties blijven bewaard en delen bedrijfsgegevens", () => {
  const memory = new Map();
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
  const workspace = structuredClone(emptyWorkspace);
  workspace.account = {
    firstName: "Mina",
    lastName: "Test",
    email: "mina@example.test",
    phone: "020 123 4567",
    photo: "data:image/png;base64,aGVsbG8=",
  };
  workspace.profile.name = "Testbedrijf";
  workspace.profile.vatNumber = "NL-DEMO";
  workspace.profile.address = "Voorbeeldstraat 1";
  workspace.notifications.approval = false;
  workspace.integrations.instagram = true;
  writeWorkspace(workspace);
  assert.deepEqual(readWorkspace(), workspace);
  // Updating the existing business profile retains newly added account details.
  const updated = {
    ...readWorkspace(),
    profile: { ...readWorkspace().profile, name: "Nieuwe naam" },
  };
  writeWorkspace(updated);
  assert.equal(readWorkspace().profile.name, "Nieuwe naam");
  assert.equal(readWorkspace().profile.vatNumber, "NL-DEMO");
  assert.deepEqual(readWorkspace().account, workspace.account);
  memory.set(
    STORAGE_KEY,
    JSON.stringify({ ...workspace, notifications: { approval: "true" } }),
  );
  assert.throws(() => readWorkspace(), /Ongeldige/);
  memory.set(
    STORAGE_KEY,
    JSON.stringify({
      ...workspace,
      account: { photo: "https://example.test/photo.jpg" },
    }),
  );
  assert.throws(() => readWorkspace(), /Ongeldige profielfoto/);
});
test("account verwijderen wist alleen Marketing AI-gegevens en meldt opslagfouten", async () => {
  const { removeWorkspace } = await import("../src/lib/storage.ts");
  const memory = new Map([
    [STORAGE_KEY, JSON.stringify(emptyWorkspace)],
    ["andere-app", "bewaren"],
  ]);
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key),
  };
  removeWorkspace();
  assert.equal(memory.has(STORAGE_KEY), false);
  assert.equal(memory.get("andere-app"), "bewaren");
  assert.deepEqual(readWorkspace(), emptyWorkspace);
  globalThis.localStorage.removeItem = () => {
    throw new Error("SecurityError");
  };
  assert.throws(() => removeWorkspace(), /SecurityError/);
});

test("dashboardplanning gebruikt weekgrenzen en sluit oude/geannuleerde content uit", async () => {
  const { localDashboardItems, thisWeek, comingWeek, mockDashboard } =
    await import("../src/lib/dashboard-data.ts");
  const now = new Date(2026, 8, 9, 12, 0, 0);
  const make = (id, status, date) => ({
    id,
    prompt: id,
    caption: "Bewaard",
    hashtags: "#test",
    status,
    date,
    createdAt: now.toISOString(),
    variant: 0,
  });
  const posts = [
    make("gisteren", "scheduled", new Date(2026, 8, 8, 18).toISOString()),
    make("morgen", "scheduled", new Date(2026, 8, 10, 18).toISOString()),
    make("volgende-week", "scheduled", new Date(2026, 8, 14, 18).toISOString()),
    make("te-laat", "scheduled", new Date(2026, 8, 16, 12).toISOString()),
    make("concept", "draft", ""),
  ];
  const original = JSON.stringify(posts);
  const items = localDashboardItems(posts);
  assert.deepEqual(
    thisWeek(items, now)
      .map((p) => p.id)
      .sort(),
    ["gisteren", "morgen"],
  );
  assert.deepEqual(
    comingWeek(items, now).map((p) => p.id),
    ["morgen", "volgende-week"],
  );
  assert.equal(items.find((p) => p.id === "concept").status, "review");
  assert.equal(JSON.stringify(posts), original);
  const mock = mockDashboard(now);
  assert.equal(thisWeek(mock.scheduled, now).length, 7);
  assert.equal(mock.attention.filter((i) => i.status === "review").length, 3);
  const reel = mock.attention.find((i) => i.status === "scheduled");
  assert.ok(
    mock.scheduled.some((i) => i.id === reel.id && i.date === reel.date),
  );
});

test("Instagram-instellingen bewaren mix, regels en vakantie zonder bestaande data te wijzigen", async () => {
  const {
    defaultInstagram,
    settingsError,
    rebalanceMix,
    effectivePolicy,
    readiness,
    simulationSlots,
  } = await import("../src/lib/instagram-model.ts");
  const config = structuredClone(defaultInstagram);
  assert.equal(settingsError(config), "");
  for (const value of [0, 40, 100, 25]) {
    config.mix = rebalanceMix(config.mix, "behind", value);
    assert.equal(
      Object.values(config.mix).reduce((a, b) => a + b, 0),
      100,
    );
    assert.equal(config.mix.behind, value);
  }
  config.forbidden.unknown = false;
  assert.match(settingsError(config), /Onbekende/);
  config.forbidden.unknown = true;
  config.days = [];
  assert.match(settingsError(config), /dag/);
  config.days = [1, 3, 5];
  config.mode = "auto";
  config.requireApproval = false;
  config.enabled = true;
  config.vacation = {
    enabled: true,
    from: "2026-09-10",
    until: "2026-09-15",
    frequency: { posts: 1, stories: 2, reels: 0 },
    publication: "review",
    notify: true,
    restore: true,
  };
  assert.equal(effectivePolicy(config, new Date(2026, 8, 12)).automatic, false);
  assert.deepEqual(
    effectivePolicy(config, new Date(2026, 8, 12)).frequency,
    config.vacation.frequency,
  );
  assert.equal(effectivePolicy(config, new Date(2026, 8, 16)).automatic, true);
  assert.deepEqual(
    effectivePolicy(config, new Date(2026, 8, 16)).frequency,
    config.frequency,
  );
  assert.ok(
    simulationSlots(config, new Date(2026, 8, 9, 10)).every(
      (s) => new Date(s.date) > new Date(2026, 8, 9, 10),
    ),
  );
  assert.equal(readiness(emptyWorkspace.profile).score, 14);
  const memory = new Map();
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
  const workspace = { ...structuredClone(emptyWorkspace), instagram: config };
  writeWorkspace(workspace);
  assert.deepEqual(readWorkspace().instagram, config);
});

test("Email AI gebruikt gedeelde contactstatussen en bewaart campagnes naast legacydata", async () => {
  const { recipients } = await import("../src/lib/contact-data.ts");
  const { generateEmail } = await import("../src/lib/providers/email-mock.ts");
  const { defaultEmail, emailCampaignValid, campaignError } =
    await import("../src/lib/email-model.ts");
  assert.equal(recipients("Alle contacten").length, 2);
  assert.equal(recipients("Nieuwe klanten").length, 0);
  assert.ok(
    recipients("Alle contacten").every((c) => c.status === "Ingeschreven"),
  );
  const p = {
    ...emptyWorkspace.profile,
    name: "Bestaand merk",
    description: "Bestaande tekst",
    website: "https://example.test",
    products: "Testproduct",
    offers: "Gratis adviesgesprek",
  };
  const c = await generateEmail({
    prompt: "Nieuwsbrief",
    kind: "Create Newsletter",
    profile: p,
    audience: "Nieuwsbriefabonnees",
    product: "Testproduct",
    offer: p.offers,
    useWebsite: true,
    variant: 0,
  });
  assert.equal(emailCampaignValid(c), true);
  assert.equal(campaignError(c), "");
  assert.match(c.body, /Testproduct/);
  assert.match(c.body, /Gratis adviesgesprek/);
  assert.match(
    campaignError({ ...c, audience: "Nieuwe klanten" }),
    /geen ingeschreven/,
  );
  assert.match(
    campaignError({ ...c, date: "2020-01-01T10:00" }, true),
    /toekomst/,
  );
  assert.match(campaignError({ ...c, ctaUrl: "javascript:alert(1)" }), /http/);
  const memory = new Map();
  globalThis.localStorage = {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => memory.set(k, v),
  };
  const w = {
    ...structuredClone(emptyWorkspace),
    profile: p,
    posts: [generateMock("Bewaren", p)],
    email: { settings: structuredClone(defaultEmail), campaigns: [c] },
  };
  writeWorkspace(w);
  assert.deepEqual(readWorkspace(), w);
  memory.set(
    STORAGE_KEY,
    JSON.stringify({
      ...w,
      email: {
        settings: w.email.settings,
        campaigns: [{ ...c, status: "invalid" }],
      },
    }),
  );
  assert.throws(() => readWorkspace(), /Ongeldige e-mail/);
});

test("Email Autopilot respecteert modus, bronnen, segmenten, mix en workflowgoedkeuring", async () => {
  const { defaultEmail, emailSettingsError, emailSlots } =
    await import("../src/lib/email-model.ts");
  const { simulateEmail } = await import("../src/lib/providers/email-mock.ts");
  const { rebalanceMix } = await import("../src/lib/instagram-model.ts");
  const s = structuredClone(defaultEmail),
    now = new Date(2026, 8, 9, 8);
  const p = {
    ...emptyWorkspace.profile,
    name: "Bestaand merk",
    description: "Bedrijfsinformatie",
    website: "https://example.test",
    products: "Product",
    offers: "Aanbieding met voorwaarden",
  };
  assert.equal(emailSettingsError(s), "");
  assert.equal(emailSlots(s, now).length, 0);
  s.mode = "auto";
  s.enabled = true;
  s.mix = rebalanceMix(s.mix, "products", 100);
  s.promotions = 0;
  s.reengagement = 0;
  assert.equal(emailSlots(s, now).length, 4);
  assert.ok(
    (await simulateEmail(s, p, now)).campaigns.every(
      (c) => c.status === "draft",
    ),
  );
  s.requireApproval = false;
  assert.ok(
    (await simulateEmail(s, p, now)).campaigns.every(
      (c) => c.status === "scheduled",
    ),
  );
  s.autoAudience = false;
  s.audience = "Nieuwe klanten";
  assert.ok(
    (await simulateEmail(s, p, now)).campaigns.every(
      (c) => c.status === "blocked",
    ),
  );
  s.audience = "Nieuwsbriefabonnees";
  s.mix = rebalanceMix(s.mix, "reviews", 100);
  assert.ok(
    (await simulateEmail(s, p, now)).campaigns.every(
      (c) => c.status === "draft",
    ),
  );
  s.uncertain = "skip";
  assert.equal((await simulateEmail(s, p, now)).campaigns.length, 0);
  s.uncertain = "review";
  s.mix = rebalanceMix(s.mix, "products", 100);
  s.allowed.products = false;
  assert.equal((await simulateEmail(s, p, now)).campaigns.length, 0);
  s.allowed.products = true;
  s.workflows.forEach((w) => {
    w.enabled = true;
    w.audience = "Nieuwsbriefabonnees";
    w.approval = true;
  });
  assert.ok(
    (await simulateEmail(s, p, now, true)).campaigns.every(
      (c) => c.status === "draft",
    ),
  );
  s.workflows.forEach((w) => (w.approval = false));
  assert.ok(
    (await simulateEmail(s, p, now, true)).campaigns.every(
      (c) => c.status === "scheduled",
    ),
  );
  s.forbidden.unsubscribed = false;
  assert.match(emailSettingsError(s), /beschermd/);
});

test("Email vakantie herstelt ritme en voorkomt verzending in Auto Create", async () => {
  const { defaultEmail, emailPolicy, emailSettingsError, emailSlots } =
    await import("../src/lib/email-model.ts");
  const s = structuredClone(defaultEmail);
  s.enabled = true;
  s.mode = "auto";
  s.requireApproval = false;
  s.vacation = {
    enabled: true,
    from: "2026-09-10",
    until: "2026-09-15",
    campaigns: 2,
    automatic: false,
    approval: true,
    notify: true,
  };
  assert.equal(emailPolicy(s, new Date(2026, 8, 12)).automatic, false);
  assert.equal(emailPolicy(s, new Date(2026, 8, 12)).weekly, 2);
  assert.equal(emailPolicy(s, new Date(2026, 8, 16)).automatic, true);
  assert.equal(emailPolicy(s, new Date(2026, 8, 16)).weekly, 1);
  s.requireApproval = true;
  s.vacation.automatic = true;
  s.vacation.approval = false;
  assert.equal(emailPolicy(s, new Date(2026, 8, 12)).automatic, false);
  s.vacation.until = "2026-09-09";
  assert.match(emailSettingsError(s), /vakantie/);
  s.vacation.enabled = false;
  s.days = [];
  assert.match(emailSettingsError(s), /dag/);
  assert.deepEqual(emailSlots(s, new Date()), []);
});

test("nieuwe werkruimtenavigatie behoudt oude tab- en bewerklinks", async () => {
  const { workspaceView } = await import("../src/lib/workspace-navigation.ts");
  assert.equal(workspaceView(null, false), "overview");
  assert.equal(workspaceView("create", false), "assist");
  assert.equal(workspaceView(null, true), "assist");
  assert.equal(workspaceView("autopilot", false), "auto");
  assert.equal(workspaceView("approvals", false), "auto");
  // "full" is a legacy tab value from the retired Full Autopilot mode.
  assert.equal(workspaceView("full", false), "auto");
  assert.equal(workspaceView("scheduled", false), "overview");
  assert.equal(workspaceView("ongeldig", false), "overview");
});
test("Auto Create kan ook met automatische vakantie-instelling niet publiceren", async () => {
  const { defaultInstagram, effectivePolicy } =
    await import("../src/lib/instagram-model.ts");
  const s = structuredClone(defaultInstagram);
  s.enabled = true;
  s.mode = "auto";
  s.vacation = {
    ...s.vacation,
    enabled: true,
    from: "2026-09-01",
    until: "2026-09-30",
    publication: "automatic",
  };
  assert.equal(effectivePolicy(s, new Date(2026, 8, 12)).automatic, false);
  s.requireApproval = false;
  assert.equal(effectivePolicy(s, new Date(2026, 8, 12)).automatic, true);
});
test("e-mailnieuwsbrieven ondersteunen maandritme zonder bestaande weekinstellingen te migreren", async () => {
  const { defaultEmail, emailSlots, emailSettingsError } =
    await import("../src/lib/email-model.ts");
  const s = {
    ...structuredClone(defaultEmail),
    enabled: true,
    mode: "auto",
    newsletters: 2,
    promotions: 0,
    reengagement: 0,
  };
  const now = new Date(2026, 8, 9, 8);
  assert.equal(emailSlots(s, now).length, 8);
  s.newsletterPeriod = "month";
  s.notify = false;
  assert.equal(emailSettingsError(s), "");
  assert.equal(emailSlots(s, now).length, 2);
});

test("Library-content blijft bewaard en wordt gevalideerd bij opslaan", async () => {
  const { libraryAssetValid } = await import("../src/lib/library-model.ts");
  const memory = new Map();
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
  assert.ok(emptyWorkspace.library.length > 0);
  assert.ok(emptyWorkspace.library.every(libraryAssetValid));
  const withAsset = {
    ...structuredClone(emptyWorkspace),
    library: [
      {
        id: "lib-1",
        name: "Testafbeelding",
        type: "image",
        dateAdded: new Date().toISOString(),
      },
    ],
  };
  writeWorkspace(withAsset);
  assert.deepEqual(readWorkspace().library, withAsset.library);
  memory.set(
    STORAGE_KEY,
    JSON.stringify({
      ...withAsset,
      library: [{ ...withAsset.library[0], type: "onbekend" }],
    }),
  );
  assert.throws(() => readWorkspace(), /Ongeldige library-gegevens/);
});

test("Reviews en instellingen blijven bewaard en worden per categorie beantwoord", async () => {
  const {
    regenerateResponse,
    categorize,
    reviewSettingsError,
    reviewValid,
    defaultReviewSettings,
  } = await import("../src/lib/review-model.ts");
  const memory = new Map();
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
  assert.ok(emptyWorkspace.review.reviews.length > 0);
  assert.ok(emptyWorkspace.review.reviews.every(reviewValid));
  assert.equal(reviewSettingsError(defaultReviewSettings), "");
  assert.equal(
    reviewSettingsError({ ...defaultReviewSettings, mode: "onbekend" }),
    "Ongeldige modus.",
  );

  const base = {
    id: "r1",
    reviewer: "Anna Jansen",
    initials: "AJ",
    date: new Date().toISOString(),
    aiResponse: "",
    status: "new",
  };
  assert.equal(categorize({ rating: 5, text: "Top!" }), "positive");
  assert.equal(categorize({ rating: 4, text: "Goed" }), "good");
  assert.equal(categorize({ rating: 3, text: "Prima" }), "neutral");
  assert.equal(categorize({ rating: 2, text: "Kon beter" }), "complaint");
  assert.equal(categorize({ rating: 1, text: "Slecht" }), "seriousComplaint");
  assert.equal(categorize({ rating: 5, text: "  " }), "noText");

  const settings = { ...defaultReviewSettings, signature: "Team Bloom" };
  const response = regenerateResponse({ ...base, rating: 1, text: "Nooit meer." }, settings);
  assert.match(response, /Team Bloom/);
  const noSignature = regenerateResponse(
    { ...base, rating: 5, text: "Top!" },
    { ...settings, signature: "" },
  );
  assert.ok(!noSignature.includes("– "));

  const withReview = {
    ...structuredClone(emptyWorkspace),
    review: {
      settings: defaultReviewSettings,
      reviews: [{ ...base, rating: 5, text: "Fantastisch!" }],
    },
  };
  writeWorkspace(withReview);
  assert.deepEqual(readWorkspace().review, withReview.review);
  memory.set(
    STORAGE_KEY,
    JSON.stringify({
      ...withReview,
      review: {
        settings: defaultReviewSettings,
        reviews: [{ ...withReview.review.reviews[0], rating: 9 }],
      },
    }),
  );
  assert.throws(() => readWorkspace(), /Ongeldige reviewgegevens/);
});

test("Brand Hub-segmenten, producten en merkstem worden bewaard en gevalideerd", async () => {
  const {
    segmentValid,
    productValid,
    brandVoiceValid,
    newSegment,
    newProduct,
    defaultBrandVoice,
  } = await import("../src/lib/brand-model.ts");
  const memory = new Map();
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
  const segment = { ...newSegment(), name: "Jonge professionals" };
  const product = { ...newProduct(), name: "Zomercollectie tas" };
  assert.ok(segmentValid(segment));
  assert.ok(productValid(product));
  assert.ok(brandVoiceValid(defaultBrandVoice));
  assert.equal(segmentValid({ ...segment, type: "Onbekend" }), false);
  assert.equal(productValid({ ...product, active: "ja" }), false);

  const withBrand = {
    ...structuredClone(emptyWorkspace),
    profile: {
      ...emptyWorkspace.profile,
      segments: [segment],
      productList: [product],
      brandVoice: { ...defaultBrandVoice, formality: "informeel" },
    },
  };
  writeWorkspace(withBrand);
  const read = readWorkspace();
  assert.deepEqual(read.profile.segments, withBrand.profile.segments);
  assert.deepEqual(read.profile.productList, withBrand.profile.productList);
  assert.deepEqual(read.profile.brandVoice, withBrand.profile.brandVoice);

  memory.set(
    STORAGE_KEY,
    JSON.stringify({
      ...withBrand,
      profile: { ...withBrand.profile, productList: [{ ...product, active: "ja" }] },
    }),
  );
  assert.throws(() => readWorkspace(), /Ongeldige productgegevens/);
});

test("AI-instructiearchitectuur combineert Brand Hub-gegevens tot gestructureerde context", async () => {
  const { buildBrandContext } = await import("../src/lib/ai/brand-context.ts");
  const {
    buildInstagramInstruction,
    buildImagePromptSpec,
  } = await import("../src/lib/ai/instagram-instruction.ts");
  const { buildEmailInstruction } = await import("../src/lib/ai/email-instruction.ts");
  const { buildReviewInstruction } = await import("../src/lib/ai/review-instruction.ts");
  const { newSegment, newProduct, defaultBrandVoice } = await import("../src/lib/brand-model.ts");

  const segment = { ...newSegment(), name: "Jonge professionals" };
  const product = { ...newProduct(), name: "Zomercollectie tas", description: "Handgemaakt leer" };
  const profile = {
    ...emptyWorkspace.profile,
    name: "Studio Bloom",
    segments: [segment],
    productList: [product],
    brandVoice: { ...defaultBrandVoice, colors: ["#6D28D9"] },
  };

  const brand = buildBrandContext(profile);
  assert.equal(brand.name, "Studio Bloom");
  assert.equal(brand.products.length, 1);
  assert.equal(brand.segments.length, 1);

  const igInstruction = buildInstagramInstruction({
    profile,
    prompt: "Laat de tas zien",
    type: "Post",
    goal: "product-promotie",
    product: product.name,
    segmentId: segment.id,
    cta: "Shop nu",
    useWebsite: false,
  });
  assert.equal(igInstruction.product?.name, product.name);
  assert.equal(igInstruction.segment?.name, segment.name);
  assert.equal(igInstruction.cta, "Shop nu");
  const imagePrompt = buildImagePromptSpec(igInstruction);
  assert.equal(imagePrompt.mainSubject, product.name);
  assert.deepEqual(imagePrompt.brandColors, ["#6D28D9"]);

  const emailInstruction = buildEmailInstruction({
    profile,
    prompt: "Nieuwe collectie",
    kind: "Create Campaign",
    audience: "Nieuwsbriefabonnees",
    product: product.name,
    tone: "informeel",
    length: "kort",
    cta: "Bekijk de collectie",
    useWebsite: false,
  });
  assert.equal(emailInstruction.product?.name, product.name);
  assert.equal(emailInstruction.length, "kort");

  const review = {
    id: "r1",
    reviewer: "Anna",
    initials: "A",
    rating: 5,
    text: "Top!",
    date: new Date().toISOString(),
    aiResponse: "",
    status: "new",
  };
  const { defaultReviewSettings } = await import("../src/lib/review-model.ts");
  const reviewInstruction = buildReviewInstruction(profile, review, defaultReviewSettings);
  assert.equal(reviewInstruction.category, "positive");
  assert.equal(reviewInstruction.brand.name, "Studio Bloom");
});

test("Instagram- en e-mailgeneratie gebruiken doel, segment en CTA uit de instructie", async () => {
  const { generateContent } = await import("../src/lib/providers/mock.ts");
  const { generateEmail } = await import("../src/lib/providers/email-mock.ts");
  const { newSegment, defaultBrandVoice } = await import("../src/lib/brand-model.ts");
  const segment = { ...newSegment(), name: "Jonge professionals" };
  const profile = {
    ...emptyWorkspace.profile,
    name: "Studio Bloom",
    segments: [segment],
    brandVoice: { ...defaultBrandVoice, formality: "informeel" },
  };
  const post = await generateContent({
    prompt: "Laat de tas zien",
    type: "Post",
    profile,
    product: "",
    useWebsite: false,
    photos: [],
    duration: 5,
    videoMode: "",
    variant: 0,
    goal: "aanbieding",
    segmentId: segment.id,
    cta: "Shop nu",
  });
  assert.match(post.caption, /Shop nu/);
  assert.match(post.caption, /Jonge professionals/);

  const email = await generateEmail({
    prompt: "Nieuwe collectie",
    kind: "Create Campaign",
    profile,
    audience: "Nieuwsbriefabonnees",
    product: "",
    offer: "",
    useWebsite: false,
    variant: 0,
    cta: "Bekijk de collectie",
  });
  assert.equal(email.cta, "Bekijk de collectie");
  assert.match(email.body, /Hoi,/);
});
