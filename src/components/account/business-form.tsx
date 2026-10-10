"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, Palette, Save } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PageHeading } from "@/components/ui";
import type { Profile } from "@/lib/types";

// Business details of the workspace (same profile fields Brand Hub uses for
// name and industry). Brand and voice live in Brand Hub.

const FIELDS: [keyof Profile, string, string, string?][] = [
  ["name", "Bedrijfsnaam", "text", "organization"],
  ["industry", "Branche", "text"],
  ["website", "Website", "url", "url"],
  ["phone", "Telefoonnummer", "tel", "tel"],
  ["address", "Adres", "text", "street-address"],
  ["postalCode", "Postcode", "text", "postal-code"],
  ["city", "Plaats", "text", "address-level2"],
  ["country", "Land", "text", "country-name"],
  ["vatNumber", "Btw-nummer", "text"],
];

function errorsOf(p: Profile) {
  const e: Partial<Record<keyof Profile, string>> = {};
  if (!p.name.trim()) e.name = "Vul je bedrijfsnaam in.";
  if (p.website.trim() && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(p.website.trim())) e.website = "Gebruik een volledig webadres, bijvoorbeeld https://jouwbedrijf.nl.";
  if (p.postalCode.trim() && !/^[0-9A-Za-z -]{3,10}$/.test(p.postalCode.trim())) e.postalCode = "Controleer de postcode.";
  if (p.vatNumber.trim() && !/^[A-Za-z]{2}[0-9A-Za-z.\s]{4,16}$/.test(p.vatNumber.trim())) e.vatNumber = "Een btw-nummer begint met de landcode, bijvoorbeeld NL123456789B01.";
  return e;
}

export function BusinessForm() {
  const { data, save } = useWorkspace();
  const [profile, setProfile] = useState(data.profile);
  const [errors, setErrors] = useState<Partial<Record<keyof Profile, string>>>({});
  const [saved, setSaved] = useState(false);
  const dirty = FIELDS.some(([k]) => profile[k] !== data.profile[k]);
  return (
    <>
      <PageHeading eyebrow="Werkruimte" title="Bedrijfsinstellingen" description="De gegevens van je bedrijf, gedeeld met je merkprofiel in Mavix." />
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const errs = errorsOf(profile);
          setErrors(errs);
          if (Object.keys(errs).length) return;
          const patch = Object.fromEntries(FIELDS.map(([k]) => [k, String(profile[k] || "").trim()]));
          setSaved(await save({ ...data, profile: { ...data.profile, ...patch } }, "Bedrijfsgegevens opgeslagen"));
        }}
      >
        <section className="panel account-panel">
          <div className="section-heading">
            <div>
              <h2>Bedrijfsgegevens</h2>
              <p>Bedrijfsnaam en branche zijn dezelfde gegevens als in Brand Hub.</p>
            </div>
          </div>
          <div className="account-panel-body account-fields">
            {FIELDS.map(([key, label, type, auto]) => (
              <label key={key} className={errors[key] ? "st-invalid" : undefined}>
                {label}
                <input
                  type={type}
                  autoComplete={auto}
                  maxLength={300}
                  aria-invalid={!!errors[key]}
                  placeholder={key === "website" ? "https://jouwbedrijf.nl" : undefined}
                  value={String(profile[key] || "")}
                  onChange={(e) => {
                    setProfile({ ...profile, [key]: e.target.value });
                    setSaved(false);
                  }}
                />
                {errors[key] && <span className="field-error">{errors[key]}</span>}
              </label>
            ))}
          </div>
        </section>
        <Link href="/brand-hub" className="panel account-panel st-crosslink">
          <Palette size={18} aria-hidden="true" />
          <span>
            <strong>Merk en merkstem</strong>
            <small>Omschrijving, doelgroep, toon, logo en kleuren beheer je in Brand Hub.</small>
          </span>
        </Link>
        <div className="account-save">
          <p role="status" className="success-message">
            {saved && !dirty ? (
              <>
                <Check size={15} aria-hidden="true" /> Opgeslagen
              </>
            ) : dirty ? (
              "Je hebt niet-opgeslagen wijzigingen."
            ) : (
              ""
            )}
          </p>
          <button className="button primary" disabled={!dirty}>
            <Save size={17} />
            Opslaan
          </button>
        </div>
      </form>
    </>
  );
}
