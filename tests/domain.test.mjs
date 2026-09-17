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
  config.mode = "full";
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
  s.mode = "full";
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
  s.mode = "full";
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
  s.mode = "auto";
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
  assert.equal(workspaceView(null, false, "full"), "overview");
  assert.equal(workspaceView("create", false, "auto"), "assist");
  assert.equal(workspaceView(null, true, "full"), "assist");
  assert.equal(workspaceView("autopilot", false, "full"), "full");
  assert.equal(workspaceView("approvals", false, "full"), "auto");
  assert.equal(workspaceView("scheduled", false, "auto"), "overview");
  assert.equal(workspaceView("ongeldig", false, "assist"), "overview");
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
  s.mode = "full";
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
