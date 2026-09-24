import type { Profile, Post } from "./types";
export type InstagramMode = "assist" | "auto";
export type ContentType =
  | "Post"
  | "Carousel"
  | "Story"
  | "Image"
  | "Reel"
  | "Animate Image"
  | "Photos to Reel"
  | "Captions & Hashtags"
  | "Content Ideas";
export type Frequency = { posts: number; stories: number; reels: number };
export type InstagramSettings = {
  mode: InstagramMode;
  enabled: boolean;
  requireApproval: boolean;
  frequency: Frequency;
  days: number[];
  times: Record<string, string>;
  bestTimes: boolean;
  mix: Record<string, number>;
  allowed: Record<string, boolean>;
  forbidden: Record<string, boolean>;
  uncertain: "review" | "skip";
  vacation: {
    enabled: boolean;
    from: string;
    until: string;
    frequency: Frequency;
    publication: "review" | "automatic";
    notify: boolean;
    restore: boolean;
  };
};
export const modes = [
  {
    id: "assist",
    title: "Assist",
    description: "AI maakt alleen content wanneer jij hierom vraagt.",
  },
  {
    id: "auto",
    title: "Auto Create",
    description:
      "AI bedenkt, maakt en plant zelfstandig content volgens jouw schema. Met 'Vraag per item toestemming' bepaal je of Mavix eerst jouw goedkeuring vraagt of direct publiceert.",
  },
] as const;
export const mixLabels = {
  products: "Producten",
  reviews: "Reviews",
  informative: "Informatief",
  behind: "Behind the scenes",
  offers: "Aanbiedingen",
};
export const allowedLabels = {
  products: "Bestaande producten promoten",
  reviews: "Reviews gebruiken",
  branding: "Algemene branding-content maken",
  tips: "Tips/informatieve content maken",
  website: "Bestaande website-informatie gebruiken",
  offers: "Bestaande aanbiedingen promoten",
};
export const forbiddenLabels = {
  discounts: "Kortingen verzinnen",
  prices: "Prijzen veranderen/verzinnen",
  hours: "Openingstijden verzinnen",
  sensitive: "Gevoelige onderwerpen gebruiken",
  unknown: "Informatie publiceren die niet in Mavix/Brand Hub staat",
};
export const defaultInstagram: InstagramSettings = {
  mode: "assist",
  enabled: false,
  requireApproval: true,
  frequency: { posts: 3, stories: 4, reels: 1 },
  days: [1, 3, 5],
  times: {
    "0": "18:00",
    "1": "18:00",
    "2": "18:00",
    "3": "18:00",
    "4": "18:00",
    "5": "18:00",
    "6": "18:00",
  },
  bestTimes: true,
  mix: { products: 40, reviews: 20, informative: 20, behind: 10, offers: 10 },
  allowed: {
    products: true,
    reviews: true,
    branding: true,
    tips: true,
    website: true,
    offers: true,
  },
  forbidden: {
    discounts: true,
    prices: true,
    hours: true,
    sensitive: true,
    unknown: true,
  },
  uncertain: "review",
  vacation: {
    enabled: false,
    from: "",
    until: "",
    frequency: { posts: 2, stories: 3, reels: 1 },
    publication: "review",
    notify: true,
    restore: true,
  },
};
export function settingsError(s: InstagramSettings): string {
  if (
    !s ||
    !["assist", "auto"].includes(s.mode) ||
    typeof s.enabled !== "boolean" ||
    typeof s.requireApproval !== "boolean"
  )
    return "Ongeldige modus.";
  const freq = (f: Frequency) =>
    f &&
    ["posts", "stories", "reels"].every(
      (k) =>
        Number.isInteger(f[k as keyof Frequency]) &&
        f[k as keyof Frequency] >= 0 &&
        f[k as keyof Frequency] <= 14,
    );
  if (!freq(s.frequency) || !freq(s.vacation?.frequency))
    return "Kies voor elk contenttype 0 tot 14 items per week.";
  if (
    !Array.isArray(s.days) ||
    !s.days.length ||
    s.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
    new Set(s.days).size !== s.days.length
  )
    return "Kies minimaal één dag.";
  if (
    typeof s.bestTimes !== "boolean" ||
    !s.times ||
    !s.days.every((d) =>
      /^([01]\d|2[0-3]):[0-5]\d$/.test(s.times[String(d)] || ""),
    )
  )
    return "Vul geldige tijden in.";
  if (
    !s.mix ||
    Object.keys(mixLabels).some(
      (k) => !Number.isInteger(s.mix[k]) || s.mix[k] < 0 || s.mix[k] > 100,
    ) ||
    Object.values(s.mix).reduce((a, b) => a + b, 0) !== 100
  )
    return "De contentmix moet samen 100% zijn.";
  if (
    !s.allowed ||
    !s.forbidden ||
    Object.keys(allowedLabels).some((k) => typeof s.allowed[k] !== "boolean") ||
    Object.keys(forbiddenLabels).some(
      (k) => typeof s.forbidden[k] !== "boolean",
    ) ||
    !s.forbidden.unknown
  )
    return "Onbekende feiten mogen nooit worden gepubliceerd.";
  if (!["review", "skip"].includes(s.uncertain))
    return "Kies wat Mavix bij twijfel moet doen.";
  const v = s.vacation;
  if (
    !v ||
    typeof v.enabled !== "boolean" ||
    typeof v.notify !== "boolean" ||
    v.restore !== true ||
    !["review", "automatic"].includes(v.publication)
  )
    return "Ongeldige vakantie-instellingen.";
  if (
    v.enabled &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(v.from) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(v.until) ||
      v.until < v.from)
  )
    return "Kies een geldige begin- en einddatum voor je vakantie.";
  return "";
}
export function rebalanceMix(
  mix: Record<string, number>,
  key: string,
  value: number,
) {
  const result = { ...mix };
  const others = Object.keys(mix).filter((k) => k !== key);
  const remaining = 100 - value;
  const sum = others.reduce((n, k) => n + mix[k], 0);
  result[key] = value;
  let left = remaining;
  others.forEach((k, i) => {
    const n =
      i === others.length - 1
        ? left
        : Math.floor(remaining * (sum ? mix[k] / sum : 1 / others.length));
    result[k] = n;
    left -= n;
  });
  return result;
}
export function readiness(profile: Profile) {
  const checks = [
    {
      label: "Bedrijfsgegevens",
      done: !!(profile.name.trim() && profile.description.trim()),
    },
    { label: "Tone of voice", done: !!profile.voice.trim() },
    { label: "Producten/diensten", done: !!profile.products?.trim() },
    { label: "Logo", done: !!profile.logo },
    { label: "Website", done: !!profile.website?.trim() },
    { label: "Contentvoorkeuren", done: !!profile.contentPreferences?.trim() },
    {
      label: "Bedrijfsfoto’s (minimaal 3)",
      done: (profile.media?.length || 0) >= 3,
    },
  ];
  return {
    checks,
    score: Math.round(
      (checks.filter((c) => c.done).length / checks.length) * 100,
    ),
  };
}
export function effectivePolicy(s: InstagramSettings, at: Date) {
  const v = s.vacation;
  const day = localDate(at);
  const away = v.enabled && day >= v.from && day <= v.until;
  return {
    frequency: away ? v.frequency : s.frequency,
    automatic:
      s.enabled &&
      s.mode === "auto" &&
      !s.requireApproval &&
      (!away || v.publication === "automatic"),
    away,
  };
}
export function localDate(d: Date) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}
export function localDateTime(d: Date) {
  return (
    localDate(d) +
    "T" +
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0")
  );
}
export function autopilotLabel(s: InstagramSettings) {
  return !s.enabled || s.mode === "assist"
    ? "Autopilot uit"
    : s.requireApproval
      ? "Auto Create actief"
      : "Auto Create actief · automatische publicatie";
}
export function simulationSlots(s: InstagramSettings, now: Date) {
  if (!s.enabled || s.mode === "assist") return [];
  const policy = effectivePolicy(s, now);
  const allowedDates: Date[] = [];
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 7);
  for (let i = 0; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    if (!s.days.includes(d.getDay())) continue;
    const time = s.bestTimes ? "18:00" : s.times[String(d.getDay())];
    const [h, m] = time.split(":").map(Number);
    d.setHours(h, m, 0, 0);
    if (d > now && d < horizon) allowedDates.push(d);
  }
  if (!allowedDates.length) return [];
  const result: { type: ContentType; date: string; automatic: boolean }[] = [];
  (["posts", "stories", "reels"] as const).forEach((key, kind) => {
    for (let i = 0; i < policy.frequency[key]; i++) {
      const d = new Date(allowedDates[i % allowedDates.length]);
      d.setMinutes(
        d.getMinutes() + kind * 10 + Math.floor(i / allowedDates.length) * 30,
      );
      result.push({
        type: key === "posts" ? "Post" : key === "stories" ? "Story" : "Reel",
        date: localDateTime(d),
        automatic: effectivePolicy(s, d).automatic,
      });
    }
  });
  return result.sort((a, b) => a.date.localeCompare(b.date));
}
export function samplePosts(now: Date): Post[] {
  return [
    "Product in de spotlight",
    "Een kijkje achter de schermen",
    "Korte productvideo",
    "Campagnecontrole",
  ].map((title, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + i + 1);
    d.setHours(18, 0, 0, 0);
    return {
      id: "ig-example-" + i,
      prompt: title,
      caption:
        "Voorbeeldconcept: vertel hier het verhaal van je bedrijf. Controleer de inhoud vóór je goedkeurt.",
      hashtags: "#jouwverhaal #inspiratie",
      createdAt: now.toISOString(),
      date: localDateTime(d),
      status: i < 2 ? "draft" : i === 2 ? "scheduled" : "blocked",
      contentType: i === 1 ? "Story" : i === 2 ? "Reel" : "Post",
      source: i === 0 ? "manual" : "autopilot",
      variant: i,
      failureReason:
        i === 3
          ? "Demo: broninformatie ontbreekt. Controleer Brand Hub."
          : undefined,
    };
  });
}
