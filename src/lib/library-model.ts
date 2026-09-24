export type LibraryAssetType = "image" | "video" | "logo" | "ai" | "template";

export type LibraryAsset = {
  id: string;
  name: string;
  type: LibraryAssetType;
  preview?: string;
  dateAdded: string;
  usedBefore?: boolean;
};

export function libraryAssetValid(a: Record<string, unknown>): boolean {
  return !!(
    a &&
    ["id", "name", "dateAdded"].every((k) => typeof a[k] === "string") &&
    ["image", "video", "logo", "ai", "template"].includes(String(a.type)) &&
    (a.preview === undefined || typeof a.preview === "string") &&
    (a.usedBefore === undefined || typeof a.usedBefore === "boolean")
  );
}

export const assetTypeLabel: Record<LibraryAssetType, string> = {
  image: "Afbeelding",
  video: "Video",
  logo: "Logo",
  ai: "AI-creatie",
  template: "Template",
};

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function sampleLibraryAssets(): LibraryAsset[] {
  return [
    {
      id: "lib-sample-1",
      name: "Zomeractie banner",
      type: "image",
      dateAdded: isoDaysAgo(2),
    },
    {
      id: "lib-sample-2",
      name: "Productshoot 01",
      type: "image",
      dateAdded: isoDaysAgo(5),
      usedBefore: true,
    },
    {
      id: "lib-sample-3",
      name: "Bedrijfslogo (paars)",
      type: "logo",
      dateAdded: isoDaysAgo(30),
    },
    {
      id: "lib-sample-4",
      name: "Reel: achter de schermen",
      type: "video",
      dateAdded: isoDaysAgo(9),
    },
    {
      id: "lib-sample-5",
      name: "AI-visual: lentecollectie",
      type: "ai",
      dateAdded: isoDaysAgo(1),
    },
    {
      id: "lib-sample-6",
      name: "Instagram post template",
      type: "template",
      dateAdded: isoDaysAgo(14),
    },
    {
      id: "lib-sample-7",
      name: "Nieuwsbrief header",
      type: "image",
      dateAdded: isoDaysAgo(20),
      usedBefore: true,
    },
    {
      id: "lib-sample-8",
      name: "AI-visual: klanttestimonial",
      type: "ai",
      dateAdded: isoDaysAgo(4),
    },
  ];
}

export function relativeDateLabel(iso: string) {
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return "Vandaag";
  if (days === 1) return "Gisteren";
  if (days < 7) return days + " dagen geleden";
  return date.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}
