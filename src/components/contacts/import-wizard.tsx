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

export function ImportWizard({
  open,
  sheet,
  fileName,
  existingContacts,
  onClose,
  onImport,
}: {
  open: boolean;
  sheet: ParsedSheet | null;
  fileName: string;
  existingContacts: Contact[];
  onClose: () => void;
  onImport: (contacts: Contact[]) => void;
}) {
  const [step, setStep] = useState<"map" | "preview">("map");
  const [mapping, setMapping] = useState<Record<string, MavixField | "">>({});
  const [mappingError, setMappingError] = useState("");
  useEffect(() => {
    if (open && sheet) {
      setMapping(guessMapping(sheet.headers));
      setStep("map");
      setMappingError("");
    }
  }, [open, sheet]);
  if (!sheet) return null;
  const preview =
    step === "preview" ? buildImportPreview(sheet, mapping, existingContacts) : [];
  const valid = preview.filter((r) => r.status === "valid").length;
  const invalid = preview.filter((r) => r.status === "invalid-email").length;
  const duplicate = preview.filter((r) => r.status === "duplicate").length;
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
          onImport(toImportedContacts(preview));
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
            geïmporteerd.
          </p>
        </>
      )}
    </ConfirmDialog>
  );
}
