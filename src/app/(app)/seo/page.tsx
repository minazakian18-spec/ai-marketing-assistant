"use client";
import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { PageHeading } from "@/components/ui";

const SECTIONS = [
  ["SEO-score", "Een totaalscore voor je website."],
  ["Technisch", "Indexering, snelheid en foutmeldingen."],
  ["Content", "Titels, beschrijvingen en koppen."],
  ["Prestaties", "Laadtijd en Core Web Vitals."],
  ["Zoekzichtbaarheid", "Vertoningen en posities via Search Console."],
];

function validUrl(value: string) {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : "https://" + value);
    return url.hostname.includes(".") ? url : null;
  } catch {
    return null;
  }
}

export default function SeoPage() {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");

  // There is no crawler or Search Console connection yet: the form validates
  // the URL but never sends it anywhere or pretends to run an audit.
  function submit(e: FormEvent) {
    e.preventDefault();
    const url = validUrl(value.trim());
    setMessage(
      url
        ? `De SEO-analyse is nog niet beschikbaar. Er is geen scan van ${url.hostname} uitgevoerd en je URL is niet verzonden.`
        : "Vul een geldige website in, bijvoorbeeld jouwbedrijf.nl.",
    );
  }

  return (
    <div className="seo">
      <PageHeading
        eyebrow="Marketing"
        title="SEO"
        description="Analyseer hoe je website presteert in zoekmachines."
      />
      <form className="panel seo-form" onSubmit={submit} noValidate>
        <label htmlFor="seo-url">Website-URL</label>
        <div>
          <input
            id="seo-url"
            inputMode="url"
            autoComplete="url"
            placeholder="jouwbedrijf.nl"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setMessage("");
            }}
          />
          <button type="submit" className="button primary">
            <Search size={16} />
            Website analyseren
          </button>
        </div>
        {message && (
          <p role="status" className="seo-message">
            {message}
          </p>
        )}
      </form>
      <div className="seo-sections">
        {SECTIONS.map(([title, text]) => (
          <section key={title} className="panel seo-section">
            <h2>{title}</h2>
            <p>{text}</p>
            <strong>—</strong>
            <small>Nog geen analyse</small>
          </section>
        ))}
      </div>
    </div>
  );
}
