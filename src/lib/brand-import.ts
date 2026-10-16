import type { Profile } from "./types";

// Website import for Brand Hub: facts read literally from the business's own
// public homepage (title, meta description, schema.org data, tel:/mailto:
// links). No AI and no guessing: a field is only suggested when the page
// states it. Nothing is applied automatically; the owner confirms each
// suggestion, and fields that are already filled stay unchecked by default.

export type ImportField = "name" | "description" | "phone" | "address" | "postalCode" | "city" | "country";
export type ImportSuggestion = { field: ImportField; label: string; value: string; current: string; source: string; replace: boolean };

const LABEL: Record<ImportField, string> = { name: "Bedrijfsnaam", description: "Omschrijving", phone: "Telefoonnummer", address: "Adres", postalCode: "Postcode", city: "Plaats", country: "Land" };
const MAX: Record<ImportField, number> = { name: 160, description: 1000, phone: 40, address: 200, postalCode: 20, city: 100, country: 100 };

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const clean = (s: unknown) => (typeof s === "string" ? decode(s).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "");

function meta(html: string, key: string) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0] || "";
  return clean(tag.match(/content=["']([^"']*)["']/i)?.[1]);
}

/** schema.org objects from JSON-LD blocks (flattened @graph), only plain data. */
function jsonLd(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const v = JSON.parse(m[1].trim());
      const list = Array.isArray(v) ? v : v && Array.isArray(v["@graph"]) ? v["@graph"] : [v];
      for (const x of list) if (x && typeof x === "object") out.push(x as Record<string, unknown>);
    } catch {
      /* malformed JSON-LD is ignored */
    }
  }
  return out;
}

const BUSINESS = /(LocalBusiness|Organization|Restaurant|Store|Cafe|Bakery|BarOrPub|Hotel|Salon|Shop|Dentist|Physician|LegalService|ProfessionalService|FoodEstablishment|HealthAndBeautyBusiness|AutomotiveBusiness|HomeAndConstructionBusiness|SportsActivityLocation)/;

/** Facts found on the page, with where each came from. */
export function extractFacts(html: string): Partial<Record<ImportField, { value: string; source: string }>> {
  const facts: Partial<Record<ImportField, { value: string; source: string }>> = {};
  const set = (f: ImportField, value: string, source: string) => {
    const v = value.trim().slice(0, MAX[f]);
    if (v && !facts[f]) facts[f] = { value: v, source };
  };
  const org = jsonLd(html).find((x) => BUSINESS.test(String(x["@type"] || "")));
  if (org) {
    set("name", clean(org.name), "gestructureerde gegevens (schema.org)");
    set("description", clean(org.description), "gestructureerde gegevens (schema.org)");
    set("phone", clean(org.telephone), "gestructureerde gegevens (schema.org)");
    const a = (org.address || {}) as Record<string, unknown>;
    if (typeof a === "object") {
      set("address", clean(a.streetAddress), "gestructureerde gegevens (schema.org)");
      set("postalCode", clean(a.postalCode), "gestructureerde gegevens (schema.org)");
      set("city", clean(a.addressLocality), "gestructureerde gegevens (schema.org)");
      const country = typeof a.addressCountry === "object" && a.addressCountry ? clean((a.addressCountry as Record<string, unknown>).name) : clean(a.addressCountry);
      set("country", country === "NL" ? "Nederland" : country === "BE" ? "België" : country, "gestructureerde gegevens (schema.org)");
    }
  }
  set("name", meta(html, "og:site_name"), "og:site_name");
  set("description", meta(html, "description") || meta(html, "og:description"), "meta-omschrijving");
  const tel = html.match(/href=["']tel:([+\d\s().-]{6,25})["']/i)?.[1];
  if (tel) set("phone", tel.replace(/\s+/g, " ").trim(), "telefoonlink op de pagina");
  if (!facts.name) {
    const title = clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
    // "Telepizza Amstelveen | Pizza bezorgen" -> "Telepizza Amstelveen"
    const first = title.split(/\s[|–—-]\s/)[0];
    if (first && first.length <= 60) set("name", first, "paginatitel");
  }
  return facts;
}

/** Suggestions to show; filled fields are offered but not pre-selected. */
export function suggestionsFor(profile: Pick<Profile, ImportField>, facts: ReturnType<typeof extractFacts>): ImportSuggestion[] {
  return (Object.keys(LABEL) as ImportField[])
    .filter((f) => facts[f] && facts[f]!.value !== (profile[f] || "").trim())
    .map((f) => ({ field: f, label: LABEL[f], value: facts[f]!.value, current: (profile[f] || "").trim(), source: facts[f]!.source, replace: !(profile[f] || "").trim() }));
}

/** Applies only the confirmed fields; everything else stays as the owner wrote it. */
export function applyConfirmed<T extends Pick<Profile, ImportField>>(profile: T, suggestions: ImportSuggestion[], confirmed: ImportField[]): T {
  const next = { ...profile };
  for (const s of suggestions) if (confirmed.includes(s.field)) (next as Record<string, unknown>)[s.field] = s.value.slice(0, MAX[s.field]);
  return next;
}
