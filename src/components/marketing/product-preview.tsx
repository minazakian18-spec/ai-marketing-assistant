"use client";
import { useEffect, useState } from "react";
import { Star, Sparkles, Instagram, Mail, CalendarDays } from "lucide-react";

const steps = [
  {
    label: "Review komt binnen",
    icon: Star,
    card: {
      title: "★★★★★ Lotte V.",
      body: "“Superfijne ervaring, het team dacht echt mee!”",
    },
  },
  {
    label: "Mavix schrijft een reactie",
    icon: Sparkles,
    card: {
      title: "Reactie klaar",
      body: "“Wat fijn om te lezen, Lotte! Dankjewel voor je vertrouwen.”",
    },
  },
  {
    label: "Instagram-post wordt gemaakt",
    icon: Instagram,
    card: {
      title: "Nieuwe post",
      body: "Caption, hashtags en beeldconcept staan klaar om te bekijken.",
    },
  },
  {
    label: "E-mailcampagne wordt klaargezet",
    icon: Mail,
    card: {
      title: "Nieuwsbrief",
      body: "Onderwerp en inhoud zijn geschreven, klaar voor goedkeuring.",
    },
  },
  {
    label: "Alles komt in de kalender",
    icon: CalendarDays,
    card: {
      title: "Deze week",
      body: "3 posts, 1 nieuwsbrief — allemaal op hun plek.",
    },
  },
];

export function ProductPreview() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setActive((n) => (n + 1) % steps.length);
    }, 3800);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="mkt-preview-card">
      <div className="mkt-preview-bar">
        <span className="mkt-preview-dot" />
        <span className="mkt-preview-dot" />
        <span className="mkt-preview-dot" />
        <span className="mkt-preview-title">Mavix werkruimte</span>
      </div>
      <div className="mkt-preview-body">
        {steps.map((step, i) => (
          <div
            key={step.label}
            className={"mkt-preview-step" + (i === active ? " active" : "")}
            aria-hidden={i !== active}
          >
            <span className="mkt-preview-step-label">
              <step.icon size={14} />
              {step.label}
            </span>
            <div className="mkt-preview-card-line">
              <strong>{step.card.title}</strong>
              <span>{step.card.body}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mkt-preview-dots">
        {steps.map((step, i) => (
          <button
            key={step.label}
            type="button"
            aria-label={"Toon stap " + (i + 1)}
            className={i === active ? "active" : ""}
            onClick={() => setActive(i)}
          />
        ))}
      </div>
    </div>
  );
}
