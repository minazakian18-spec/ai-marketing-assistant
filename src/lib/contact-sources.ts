import type { Contact } from "./types";

// Where a contact came from in business terms (an order platform, the website,
// added by hand). Stored as Contact.origin: a preset id below, or a custom
// label the user typed. Separate from Contact.source, which records how the
// record entered Mavix (manual, import, newsletter form) and stays as it is.
export type SourcePreset = { id: string; label: string; tone: string };

export const SOURCE_PRESETS: SourcePreset[] = [
  { id: "thuisbezorgd", label: "Thuisbezorgd", tone: "orange" },
  { id: "sitedish", label: "Sitedish", tone: "red" },
  { id: "ubereats", label: "Uber Eats", tone: "green" },
  { id: "website", label: "Website", tone: "purple" },
  { id: "manual", label: "Handmatig toegevoegd", tone: "slate" },
];
export const OTHER_SOURCE = "other";
export const MAX_ORIGIN_LENGTH = 60;

const presetById = new Map(SOURCE_PRESETS.map((p) => [p.id, p]));

/** The folder a contact belongs to; older contacts without origin get a sensible default. */
export function originOf(c: Contact): string {
  if (c.origin) return c.origin;
  if (c.source === "newsletter") return "website";
  if (c.source === "manual") return "manual";
  return OTHER_SOURCE;
}

export function sourceLabel(id: string): string {
  if (id === OTHER_SOURCE) return "Overig / geïmporteerd";
  return presetById.get(id)?.label || id;
}

export function sourceTone(id: string): string {
  if (id === OTHER_SOURCE) return "grey";
  return presetById.get(id)?.tone || "indigo";
}

/** Turns what the user picked or typed into a stored origin (preset id or trimmed label). */
export function normalizeOrigin(value: string): string | undefined {
  const v = value.trim().slice(0, MAX_ORIGIN_LENGTH);
  if (!v) return undefined;
  const preset = SOURCE_PRESETS.find((p) => p.id === v || p.label.toLowerCase() === v.toLowerCase());
  return preset ? preset.id : v;
}

/** Folders to show: every preset, then custom sources in use, then "other" if used. */
export function sourceFolders(contacts: Contact[]): { id: string; label: string; tone: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of contacts) {
    const id = originOf(c);
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  const custom = [...counts.keys()].filter((id) => !presetById.has(id) && id !== OTHER_SOURCE).sort((a, b) => a.localeCompare(b, "nl"));
  const ids = [...SOURCE_PRESETS.map((p) => p.id), ...custom, ...(counts.has(OTHER_SOURCE) ? [OTHER_SOURCE] : [])];
  return ids.map((id) => ({ id, label: sourceLabel(id), tone: sourceTone(id), count: counts.get(id) || 0 }));
}
