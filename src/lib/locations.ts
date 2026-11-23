// The 20 location photos in Brand Hub: one per perspective, inside and outside,
// so Mavix knows what the business really looks like. Social uses them as the
// scene for AI images ("op het terras", "aan de bar"). Photos are stored in the
// Bibliotheek (album "Locatiefoto's"); the profile keeps shot id -> media ref.

export type LocationArea = "buiten" | "binnen" | "keuken" | "details";
export type LocationShot = { id: string; label: string; area: LocationArea; tip: string; keywords: string[] };

export const LOCATION_ALBUM = "Locatiefoto's";

export const LOCATION_SHOTS: LocationShot[] = [
  { id: "gevel", label: "Gevel recht van voren", area: "buiten", tip: "Sta aan de overkant van de straat en zet de hele gevel met naam in beeld. Overdag, zonder auto's ervoor.", keywords: ["gevel", "buiten", "pand", "voorkant"] },
  { id: "gevel-schuin", label: "Gevel schuin", area: "buiten", tip: "Loop een paar meter opzij en fotografeer de gevel schuin, zodat je diepte ziet.", keywords: ["gevel", "straat"] },
  { id: "entree", label: "Entree en deur", area: "buiten", tip: "Van dichtbij: de ingang zoals een gast hem ziet als hij binnenkomt.", keywords: ["entree", "ingang", "deur", "welkom"] },
  { id: "terras", label: "Terras", area: "buiten", tip: "Het terras met tafels gedekt, bij voorkeur met zon. Geen gasten herkenbaar in beeld.", keywords: ["terras", "buiten", "zomer", "zon"] },
  { id: "avond-buiten", label: "Buiten bij avond", area: "buiten", tip: "De gevel of het terras als de verlichting aan is, net na zonsondergang.", keywords: ["avond", "verlichting", "sfeer", "nacht"] },
  { id: "overzicht", label: "Overzicht van de zaak", area: "binnen", tip: "Vanuit een hoek van de ruimte, zodat je zoveel mogelijk van het interieur ziet.", keywords: ["interieur", "binnen", "zaak", "restaurant"] },
  { id: "overzicht-andere-kant", label: "Overzicht andere kant", area: "binnen", tip: "Vanuit de tegenovergestelde hoek, zodat Mavix de hele ruimte kent.", keywords: ["interieur", "binnen"] },
  { id: "tafel-gedekt", label: "Gedekte tafel", area: "binnen", tip: "Eén tafel netjes gedekt, op ooghoogte van een zittende gast.", keywords: ["tafel", "diner", "eten", "gerecht", "pizza", "pasta"] },
  { id: "tafel-boven", label: "Tafel van bovenaf", area: "binnen", tip: "Recht van boven op een (lege of gedekte) tafel: het tafelblad en de materialen.", keywords: ["tafel", "bovenaf", "flatlay", "gerecht"] },
  { id: "bar", label: "Bar of toonbank", area: "binnen", tip: "De bar of toonbank van voren, met wat erachter staat.", keywords: ["bar", "toonbank", "drankje", "cocktail", "koffie"] },
  { id: "bar-zijkant", label: "Bar vanaf de zijkant", area: "binnen", tip: "Langs de bar fotograferen, zodat je de lengte en de krukken ziet.", keywords: ["bar", "drankje"] },
  { id: "zithoek", label: "Gezellige zithoek", area: "binnen", tip: "De mooiste of knusste plek in de zaak.", keywords: ["zithoek", "gezellig", "lounge", "sfeer"] },
  { id: "raam", label: "Plek bij het raam", area: "binnen", tip: "Een tafel bij het raam met daglicht.", keywords: ["raam", "daglicht", "lunch", "ontbijt"] },
  { id: "avond-binnen", label: "Binnen bij avond", area: "binnen", tip: "Het interieur 's avonds met de sfeerverlichting aan.", keywords: ["avond", "diner", "sfeer", "kaarslicht"] },
  { id: "keuken", label: "Keuken", area: "keuken", tip: "Een overzicht van de (schone) keuken of open keuken.", keywords: ["keuken", "chef", "koken", "achter de schermen"] },
  { id: "oven-werkplek", label: "Oven of werkplek", area: "keuken", tip: "Je belangrijkste werkplek: de pizzaoven, grill, koffiemachine of werkbank.", keywords: ["oven", "pizzaoven", "grill", "houtoven", "werkplek"] },
  { id: "uitgifte", label: "Uitgifte of pass", area: "keuken", tip: "De plek waar de gerechten klaar worden gezet of worden meegegeven.", keywords: ["uitgifte", "afhalen", "bezorgen", "pass"] },
  { id: "details-interieur", label: "Detail van het interieur", area: "details", tip: "Iets typisch: een lamp, muurschildering, plant of bijzonder materiaal.", keywords: ["detail", "interieur", "decoratie"] },
  { id: "servies", label: "Servies en glaswerk", area: "details", tip: "Jullie borden, glazen of verpakking van dichtbij.", keywords: ["servies", "bord", "glas", "verpakking", "afhaal"] },
  { id: "menukaart", label: "Menukaart of bord", area: "details", tip: "De menukaart, het krijtbord of de vitrine (alleen als sfeerbeeld).", keywords: ["menu", "menukaart", "krijtbord", "vitrine"] },
];

export const AREA_LABEL: Record<LocationArea, string> = { buiten: "Buiten", binnen: "Binnen", keuken: "Keuken en werkplek", details: "Details" };

export const shotById = (id: string) => LOCATION_SHOTS.find((s) => s.id === id);

/** Best location for a brief, by simple keyword match (or the first available). */
export function suggestLocation(brief: string, available: string[]): string | null {
  const text = brief.toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const shot of LOCATION_SHOTS) {
    if (!available.includes(shot.id)) continue;
    const score = shot.keywords.filter((k) => text.includes(k)).length;
    if (score > 0 && (!best || score > best.score)) best = { id: shot.id, score };
  }
  return best?.id || null;
}
