"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Pause, Play } from "lucide-react";
import { Reveal } from "./reveal";

// Business showcase under the hero. Only Telepizza really builds Mavix with
// us (real: true). All other cards are clearly labelled, fictional examples
// that show which kinds of businesses Mavix is designed for: no quotes,
// numbers or results are attributed to them.
type Business = { name: string; kind: string; place: string; logo: string; tag: string; tone: string; real?: boolean; plate?: string };

const BUSINESSES: Business[] = [
  { name: "Telepizza", kind: "Pizzeria", place: "Amstelveen", logo: "/partners/telepizza-amstelveen.webp", plate: "#1d1530", tag: "Review AI", tone: "#fde8e8", real: true },
  { name: "Portofino", kind: "Italiaans restaurant", place: "Utrecht", logo: "/showcase/portofino.svg", tag: "Social AI", tone: "#e3f1f6" },
  { name: "Trattoria Nonna Lucia", kind: "Italiaans restaurant", place: "Rotterdam", logo: "/showcase/nonna-lucia.svg", tag: "Contentkalender", tone: "#fbf0dc" },
  { name: "Studio Marlow", kind: "Kapsalon", place: "Amsterdam-Zuid", logo: "/showcase/studio-marlow.svg", tag: "Instagram-carrousels", tone: "#f1ebe2" },
  { name: "Volt Mobile", kind: "Telefoon- en elektronicawinkel", place: "Eindhoven", logo: "/showcase/volt-mobile.svg", tag: "Email AI", tone: "#e2effd" },
  { name: "De Korenaar", kind: "Bakkerij en koffiebar", place: "Leiden", logo: "/showcase/de-korenaar.svg", tag: "Nieuwsbrieven", tone: "#f7ecd8" },
  { name: "FORMA", kind: "Personal training", place: "Den Haag", logo: "/showcase/forma.svg", tag: "Mavix Agent", tone: "#eef7dc" },
  { name: "Wilde Weide", kind: "Bloemenatelier", place: "Groningen", logo: "/showcase/wilde-weide.svg", tag: "Review AI", tone: "#fbe7ee" },
];

function Card({ b }: { b: Business }) {
  return (
    <li className="hs-biz" style={{ ["--tone" as string]: b.tone }}>
      <span className={"hs-biz-badge" + (b.real ? " is-real" : "")}>{b.real ? "Bouwt mee aan Mavix" : "Voorbeeld"}</span>
      <span className="hs-biz-logo" style={b.plate ? { background: b.plate } : undefined}>
        <Image src={b.logo} alt={`Logo van ${b.name}`} width={84} height={84} loading="eager" unoptimized />
      </span>
      <strong>{b.name}</strong>
      <span className="hs-biz-kind">{b.kind}</span>
      <span className="hs-biz-place">{b.place}</span>
      <span className="hs-biz-tag">{b.tag}</span>
    </li>
  );
}

export function PartnersStrip() {
  const [paused, setPaused] = useState(false);
  return (
    <section className="hs-partners" aria-labelledby="hs-partners-title">
      <div className="mkt-container">
        <Reveal className="hs-partners-head">
          <span className="mkt-eyebrow">Samen met ondernemers gebouwd</span>
          <h2 id="hs-partners-title" className="mkt-h2">
            Gebouwd met ondernemers.
            <br />
            <span>Ontworpen voor jouw bedrijf.</span>
          </h2>
          <p>Mavix groeit mee met wat lokale ondernemers echt nodig hebben: van de pizzeria op de hoek tot de kapsalon in de straat. Telepizza Amstelveen bouwt als beta-partner mee; de andere bedrijven zijn voorbeelden van zaken waarvoor Mavix is ontworpen.</p>
        </Reveal>
      </div>
      <div className={"hs-marquee" + (paused ? " is-paused" : "")}>
        <ul className="hs-marquee-track" aria-label="Bedrijven waarvoor Mavix is ontworpen">
          {BUSINESSES.map((b) => (
            <Card key={b.name} b={b} />
          ))}
        </ul>
        {/* Second copy only for the seamless loop: hidden from assistive tech, no interactive elements. */}
        <ul className="hs-marquee-track" aria-hidden="true">
          {BUSINESSES.map((b) => (
            <Card key={b.name} b={b} />
          ))}
        </ul>
      </div>
      <div className="mkt-container hs-partners-foot">
        <button type="button" className="hs-pause" onClick={() => setPaused(!paused)} aria-pressed={paused}>
          {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
          {paused ? "Beweging hervatten" : "Beweging pauzeren"}
        </button>
        <p>
          <span className="hs-legend is-real" /> Echte beta-partner <span className="hs-legend" /> Fictief voorbeeldbedrijf
        </p>
        <Link href="/aanvragen" className="hs-partners-cta">
          Bouw mee als beta-partner <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
