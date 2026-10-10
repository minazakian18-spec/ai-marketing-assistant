import * as XLSX from "xlsx";
import type { Contact } from "./types";

export type MavixField =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "company"
  | "group";

export const mavixFields: MavixField[] = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "company",
  "group",
];

export const mavixFieldLabel: Record<MavixField, string> = {
  firstName: "Voornaam",
  lastName: "Achternaam",
  email: "E-mailadres",
  phone: "Telefoonnummer",
  company: "Bedrijf",
  group: "Tag / groep",
};

export type ParsedSheet = {
  headers: string[];
  rows: string[][];
};

export async function parseContactFile(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = workbook.Sheets[sheetName];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  if (!raw.length) return { headers: [], rows: [] };
  const headers = raw[0].map((h) => String(h ?? "").trim());
  const dataRows = raw
    .slice(1)
    .filter((row) => row.some((cell) => String(cell ?? "").trim()));
  return {
    headers,
    rows: dataRows.map((row) =>
      headers.map((_, i) => String(row[i] ?? "").trim()),
    ),
  };
}

const guessRules: [RegExp, MavixField][] = [
  [/e[-\s]?mail/i, "email"],
  [/voornaam|first\s*name|given\s*name/i, "firstName"],
  [/achternaam|last\s*name|surname|family\s*name/i, "lastName"],
  [/telefoon|phone|mobiel|mobile/i, "phone"],
  [/bedrijf|company|organisatie|organization/i, "company"],
  [/tag|groep|group|segment/i, "group"],
];

export function guessMapping(
  headers: string[],
): Record<string, MavixField | ""> {
  const mapping: Record<string, MavixField | ""> = {};
  const used = new Set<MavixField>();
  for (const header of headers) {
    const match = guessRules.find(([re]) => re.test(header));
    if (match && !used.has(match[1])) {
      mapping[header] = match[1];
      used.add(match[1]);
    } else {
      mapping[header] = "";
    }
  }
  return mapping;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ImportRowStatus = "valid" | "invalid-email" | "duplicate";
export type ImportRowResult = {
  data: Partial<Record<MavixField, string>>;
  status: ImportRowStatus;
};

export function buildImportPreview(
  sheet: ParsedSheet,
  mapping: Record<string, MavixField | "">,
  existing: Contact[],
): ImportRowResult[] {
  const existingEmails = new Set(existing.map((c) => c.email.toLowerCase()));
  const seenInFile = new Set<string>();
  return sheet.rows.map((row) => {
    const data: Partial<Record<MavixField, string>> = {};
    sheet.headers.forEach((header, i) => {
      const field = mapping[header];
      if (field && row[i]) data[field] = row[i];
    });
    const email = (data.email || "").trim();
    if (!email || !EMAIL_RE.test(email))
      return { data, status: "invalid-email" };
    const key = email.toLowerCase();
    if (existingEmails.has(key) || seenInFile.has(key))
      return { data, status: "duplicate" };
    seenInFile.add(key);
    return { data, status: "valid" };
  });
}

// Imported addresses get "Niet bevestigd" unless the user confirms that these
// people gave permission for marketing e-mail.
export function toImportedContacts(results: ImportRowResult[], consented = false): Contact[] {
  const now = new Date().toISOString();
  return results
    .filter((r): r is ImportRowResult & { status: "valid" } =>
      r.status === "valid",
    )
    .map((r, i) => ({
      id: "contact-import-" + Date.now() + "-" + i,
      firstName: r.data.firstName || "",
      lastName: r.data.lastName || "",
      email: r.data.email || "",
      phone: r.data.phone || undefined,
      company: r.data.company || undefined,
      group: r.data.group || undefined,
      status: consented ? ("Ingeschreven" as const) : ("Niet bevestigd" as const),
      source: "import" as const,
      createdAt: now,
    }));
}
