export type ReviewStatus = "new" | "drafted" | "approved" | "published" | "flagged";
export type ResponseMode = "assist" | "auto";

export type Review = {
  id: string;
  reviewer: string;
  initials: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  date: string;
  aiResponse: string;
  status: ReviewStatus;
  autoHandled?: boolean;
};

export type ReviewAutoReplySettings = {
  mode: ResponseMode;
  enabled: boolean;
  requireApproval: boolean;
  autoPublishMinRating: number;
  manualBelowRating: number;
  tone: string;
  signature: string;
  notifyOnLowRating: boolean;
};

export const defaultReviewSettings: ReviewAutoReplySettings = {
  mode: "assist",
  enabled: false,
  requireApproval: true,
  autoPublishMinRating: 4,
  manualBelowRating: 3,
  tone: "Warm en persoonlijk, met een bedankje voor de tijd die de klant nam.",
  signature: "Team Mavix",
  notifyOnLowRating: true,
};

export const responseModeName = (mode: ResponseMode) =>
  mode === "auto" ? "Auto Create" : "Assist";

export function reviewValid(r: Record<string, unknown>): boolean {
  return !!(
    r &&
    ["id", "reviewer", "initials", "text", "date", "aiResponse"].every(
      (k) => typeof r[k] === "string",
    ) &&
    [1, 2, 3, 4, 5].includes(Number(r.rating)) &&
    ["new", "drafted", "approved", "published", "flagged"].includes(
      String(r.status),
    ) &&
    (r.autoHandled === undefined || typeof r.autoHandled === "boolean")
  );
}

export function reviewSettingsError(s: ReviewAutoReplySettings): string {
  if (
    !s ||
    !["assist", "auto"].includes(s.mode) ||
    typeof s.enabled !== "boolean" ||
    typeof s.requireApproval !== "boolean"
  )
    return "Ongeldige modus.";
  if (
    !Number.isInteger(s.autoPublishMinRating) ||
    s.autoPublishMinRating < 1 ||
    s.autoPublishMinRating > 5
  )
    return "Ongeldige instelling voor automatisch publiceren.";
  if (
    !Number.isInteger(s.manualBelowRating) ||
    s.manualBelowRating < 1 ||
    s.manualBelowRating > 5
  )
    return "Ongeldige instelling voor handmatige controle.";
  if (typeof s.tone !== "string" || typeof s.signature !== "string")
    return "Ongeldige instellingen.";
  if (typeof s.notifyOnLowRating !== "boolean") return "Ongeldige instellingen.";
  return "";
}

export const responseModeDescription = (mode: ResponseMode) =>
  mode === "auto"
    ? "Mavix bedenkt en stelt reacties op. Met 'Vraag per item toestemming' bepaal je of Mavix eerst jouw goedkeuring vraagt of direct publiceert."
    : "Jij vraagt zelf om een reactievoorstel per review.";

export const statusLabel: Record<ReviewStatus, string> = {
  new: "Nieuw",
  drafted: "Concept klaar",
  approved: "Goedgekeurd",
  published: "Gepubliceerd · demo",
  flagged: "Aandacht nodig",
};

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(9 + (days % 6), 15, 0, 0);
  return d.toISOString();
}

export type ReviewCategory =
  | "noText"
  | "positive"
  | "good"
  | "neutral"
  | "complaint"
  | "seriousComplaint";

export const categoryLabel: Record<ReviewCategory, string> = {
  noText: "Review zonder tekst",
  positive: "5-sterren review",
  good: "4-sterren review",
  neutral: "Neutrale review",
  complaint: "Klacht",
  seriousComplaint: "Ernstige klacht",
};

export function categorize(review: Pick<Review, "rating" | "text">): ReviewCategory {
  if (!review.text.trim()) return "noText";
  if (review.rating === 5) return "positive";
  if (review.rating === 4) return "good";
  if (review.rating === 3) return "neutral";
  if (review.rating === 2) return "complaint";
  return "seriousComplaint";
}

const variantPools: Record<ReviewCategory, string[]> = {
  positive: [
    "Wat een fijne review, {name}! Dankjewel voor je vertrouwen — we zijn blij dat het is bevallen.",
    "Super om te lezen, {name}! Bedankt dat je de tijd nam om dit te delen, tot snel weer.",
    "Dankjewel {name}! Dit soort reacties geeft ons team veel energie om zo door te gaan.",
  ],
  good: [
    "Bedankt voor je mooie review, {name}! Fijn dat je tevreden bent — we kijken ook naar de punten die nog beter kunnen.",
    "Dankjewel {name}, goed om te lezen! We nemen je opmerking mee om het de volgende keer nog beter te doen.",
  ],
  neutral: [
    "Bedankt voor je eerlijke feedback, {name}. We nemen je punten mee om de ervaring te verbeteren.",
    "Fijn dat je de tijd nam om te reageren, {name} — je opmerking helpt ons scherp te blijven.",
  ],
  complaint: [
    "Onze excuses voor deze ervaring, {name}. Neem gerust contact met ons op, dan zoeken we samen naar een oplossing.",
    "Vervelend om te lezen, {name}. Dit is niet hoe we het bedoelen — we nemen persoonlijk contact met je op.",
  ],
  seriousComplaint: [
    "Onze oprechte excuses, {name}. Dit is niet de ervaring die we voor ogen hebben en we nemen dit hoog op — we nemen zo snel mogelijk persoonlijk contact met je op.",
    "Wat vervelend om te lezen, {name}. Dit hoort niet onze standaard te zijn. We nemen direct contact met je op om dit recht te zetten.",
  ],
  noText: [
    "Dankjewel voor je {rating}-sterren beoordeling, {name}! Mocht je nog iets willen toelichten, dan horen we dat graag.",
  ],
};

function stripSignature(text: string) {
  return text.split("\n\n– ")[0];
}

export function regenerateResponse(
  review: Review,
  settings?: ReviewAutoReplySettings,
): string {
  const category = categorize(review);
  const pool = variantPools[category];
  const firstName = review.reviewer.split(" ")[0];
  const fill = (t: string) =>
    t.replace("{name}", firstName).replace("{rating}", String(review.rating));
  const options = pool
    .map(fill)
    .filter((t) => t !== stripSignature(review.aiResponse));
  const base = options.length ? options[Math.floor(Math.random() * options.length)] : fill(pool[0]);
  const signature = settings?.signature.trim();
  return signature ? `${base}\n\n– ${signature}` : base;
}

export function sampleReviews(): Review[] {
  const raw: Omit<Review, "id" | "initials">[] = [
    {
      reviewer: "Lotte Verhoeven",
      rating: 5,
      text: "Fantastische ervaring van begin tot eind! Het team dacht actief mee en de communicatie was top. Kom zeker terug.",
      date: isoDaysAgo(1),
      aiResponse:
        "Wat fijn om te lezen, Lotte! Dankjewel voor je vertrouwen en de leuke woorden — we hopen je snel weer te mogen verwelkomen.",
      status: "drafted",
    },
    {
      reviewer: "Youssef El Amrani",
      rating: 4,
      text: "Goede kwaliteit en nette afhandeling. Levering duurde iets langer dan verwacht, maar het resultaat maakte veel goed.",
      date: isoDaysAgo(2),
      aiResponse:
        "Bedankt voor je review, Youssef! Fijn dat je tevreden bent over het resultaat — we nemen de levertijd zeker mee als aandachtspunt.",
      status: "published",
      autoHandled: true,
    },
    {
      reviewer: "Marieke de Groot",
      rating: 2,
      text: "Had meer verwacht op basis van de website. De afspraak werd ook een kwartier later ingepland dan gecommuniceerd.",
      date: isoDaysAgo(3),
      aiResponse:
        "Vervelend om te horen, Marieke — dit is niet de ervaring die we voor ogen hebben. Neem je gerust contact met ons op, dan kijken we samen naar een oplossing.",
      status: "flagged",
    },
    {
      reviewer: "Tom Bakker",
      rating: 5,
      text: "Al jaren klant en nog altijd top service. Vriendelijk personeel en ze denken echt mee met wat bij je past.",
      date: isoDaysAgo(4),
      aiResponse:
        "Dankjewel voor je trouw, Tom! Zulke reacties geven ons team enorm veel energie. Tot de volgende keer!",
      status: "published",
      autoHandled: true,
    },
    {
      reviewer: "Sanne Willemsen",
      rating: 3,
      text: "Prima product, maar de klantenservice reageerde traag op mijn vraag over de garantie.",
      date: isoDaysAgo(6),
      aiResponse:
        "Bedankt voor je eerlijke feedback, Sanne. We vinden een snelle opvolging belangrijk en gaan hiermee aan de slag — mail ons gerust nogmaals als je nog vragen hebt.",
      status: "new",
    },
    {
      reviewer: "Daan Peeters",
      rating: 5,
      text: "Verrast door de persoonlijke aanpak. Precies gekregen wat we nodig hadden, zonder onnodige extra's.",
      date: isoDaysAgo(8),
      aiResponse:
        "Super om te horen, Daan! Fijn dat de aanpak paste bij wat je zocht — bedankt voor het delen van je ervaring.",
      status: "new",
    },
    {
      reviewer: "Fenna Mulder",
      rating: 1,
      text: "Teleurstellend. De afspraak werd zonder duidelijke reden geannuleerd en ik moest zelf achter een nieuwe datum aan.",
      date: isoDaysAgo(10),
      aiResponse:
        "Onze excuses voor deze gang van zaken, Fenna. Dit hoort niet onze standaard te zijn — we nemen persoonlijk contact met je op om dit recht te zetten.",
      status: "flagged",
    },
  ];
  return raw.map((r, i) => ({
    ...r,
    id: "review-sample-" + i,
    initials: initialsOf(r.reviewer),
  }));
}
