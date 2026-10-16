"use client";
import { Fragment, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import {
  buildImportPreview,
  guessMapping,
  mavixFields,
  mavixFieldLabel,
  toImportedContacts,
  type MavixField,
  type ParsedSheet,
} from "@/lib/contact-import";
import type { Contact } from "@/lib/types";
import { normalizeOrigin, sourceLabel } from "@/lib/contact-sources";
import { mergeInto } from "@/lib/contact-segments";

export function ImportWizard({
  open,
  sheet,
  fileName,
  existingContacts,
  sources,
  defaultOrigin,
  onClose,
  onImport,
}: {
  open: boolean;
  sheet: ParsedSheet | null;
  fileName: string;
  existingContacts: Contact[];
  sources: string[];
  defaultOrigin?: string;
  onClose: () => void;
  onImport: (contacts: Contact[], updated: Contact[]) => void;
}) {
  const [step, setStep] = useState<"map" | "preview">("map");
  const [mapping, setMapping] = useState<Record<string, MavixField | "">>({});
  const [mappingError, setMappingError] = useState("");
  const [consented, setConsented] = useState(false);
  const [origin, setOrigin] = useState("");
  const [merge, setMerge] = useState(false);
  useEffect(() => {
    if (open && sheet) {
      setMapping(guessMapping(sheet.headers));
      setStep("map");
      setMappingError("");
      setConsented(false);
      setMerge(false);
      setOrigin(defaultOrigin ? sourceLabel(defaultOrigin) : "");
    }
  }, [open, sheet, defaultOrigin]);
  if (!sheet) return null;
  const preview =
    step === "preview" ? buildImportPreview(sheet, mapping, existingContacts) : [];
  const valid = preview.filter((r) => r.status === "valid").length;
  const invalid = preview.filter((r) => r.status === "invalid-email").length;
  const duplicate = preview.filter((r) => r.status === "duplicate").length;
  // Duplicates of existing contacts can fill that contact's empty fields (name,
  // phone, company, group). Consent, status and source never change.
  const byEmail = new Map(existingContacts.map((c) => [c.email.toLowerCase(), c]));
  const merges = preview
    .filter((r) => r.status === "duplicate" && byEmail.has((r.data.email || "").trim().toLowerCase()))
    .map((r) => mergeInto(byEmail.get((r.data.email || "").trim().toLowerCase())!, r.data))
    .filter((m) => m.changed.length)
    .filter((m, i, all) => all.findIndex((x) => x.contact.id === m.contact.id) === i);
  const hasEmailMapped = Object.values(mapping).includes("email");
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title={step === "map" ? "Kolommen koppelen" : "Importvoorbeeld"}
      confirmLabel={
        step === "map"
          ? "Volgende: voorbeeld bekijken"
          : "Importeer " + valid + " contact" + (valid === 1 ? "" : "en")
      }
      onConfirm={() => {
        if (step === "map") {
          if (!hasEmailMapped) {
            setMappingError(
              "Koppel minimaal één kolom aan E-mailadres om verder te gaan.",
            );
            return;
          }
          setStep("preview");
        } else {
          const chosen = normalizeOrigin(origin);
          onImport(
            toImportedContacts(preview, consented).map((c) => (chosen ? { ...c, origin: chosen } : c)),
            merge ? merges.map((m) => m.contact) : [],
          );
          onClose();
        }
      }}
    >
      {step === "map" ? (
        <>
          <p className="field-note">
            We vonden {sheet.rows.length} rijen in &ldquo;{fileName}
            &rdquo;. Koppel elke kolom aan een Mavix-veld.
          </p>
          <div className="import-mapping-table">
            <span className="import-mapping-head">Kolom in bestand</span>
            <span />
            <span className="import-mapping-head">Mavix-veld</span>
            {sheet.headers.map((header) => (
              <Fragment key={header}>
                <span className="import-mapping-column">
                  {header || "(zonder naam)"}
                </span>
                <ArrowRight size={14} aria-hidden="true" />
                <select
                  aria-label={"Koppeling voor kolom " + header}
                  value={mapping[header] || ""}
                  onChange={(e) => {
                    setMapping({
                      ...mapping,
                      [header]: e.target.value as MavixField | "",
                    });
                    setMappingError("");
                  }}
                >
                  <option value="">Niet importeren</option>
                  {mavixFields.map((f) => (
                    <option key={f} value={f}>
                      {mavixFieldLabel[f]}
                    </option>
                  ))}
                </select>
              </Fragment>
            ))}
          </div>
          {mappingError && <p className="field-error">{mappingError}</p>}
        </>
      ) : (
        <>
          <p>Importeren van {sheet.rows.length} contacten</p>
          <div className="import-stats">
            <div className="import-stat valid">
              <strong>{valid}</strong>
              <span>Geldige contacten</span>
            </div>
            <div className="import-stat invalid">
              <strong>{invalid}</strong>
              <span>Ongeldige e-mailadressen</span>
            </div>
            <div className="import-stat duplicate">
              <strong>{duplicate}</strong>
              <span>Duplicaten</span>
            </div>
          </div>
          <p className="field-note">
            Ongeldige e-mailadressen en contacten die al bestaan worden niet
            als nieuw contact geïmporteerd.
          </p>
          {merges.length > 0 && (
            <label className="contacts-consent-check">
              <input type="checkbox" checked={merge} onChange={(e) => setMerge(e.target.checked)} />
              <span>
                Vul lege gegevens aan bij {merges.length} bestaande {merges.length === 1 ? "contact" : "contacten"} (bijvoorbeeld{" "}
                {merges[0].contact.email}: {merges[0].changed.map((k) => mavixFieldLabel[k as MavixField] || k).join(", ").toLowerCase()}). Ingevulde gegevens en
                toestemming blijven zoals ze zijn.
              </span>
            </label>
          )}
          <label>
            Bron van deze contacten
            <input
              value={origin}
              list="import-source-list"
              maxLength={60}
              placeholder="Bijv. Thuisbezorgd, Sitedish of Uber Eats"
              onChange={(e) => setOrigin(e.target.value)}
            />
            <datalist id="import-source-list">
              {sources.map((s) => (
                <option key={s} value={sourceLabel(s)} />
              ))}
            </datalist>
          </label>
          <label className="contacts-consent-check">
            <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} />
            <span>
              Deze mensen hebben toestemming gegeven voor e-mailmarketing (nieuwsbrief). Zonder vinkje krijgen ze de status
              &ldquo;Niet bevestigd&rdquo; en ontvangen ze geen campagnes.
            </span>
          </label>
        </>
      )}
    </ConfirmDialog>
  );
}
