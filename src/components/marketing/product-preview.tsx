"use client";
import { useEffect, useState } from "react";
import { Star, Sparkles, CheckCheck, Send } from "lucide-react";

const steps = [
  {
    label: "1. Review komt binnen",
    icon: Star,
    card: {
      title: "★★★★★ Lotte V.",
      body: "“Superfijne ervaring, het team dacht echt mee!”",
    },
  },
  {
    label: "2. Mavix stelt een reactie voor",
    icon: Sparkles,
    card: {
      title: "AI-concept klaar",
      body: "“Wat fijn om te lezen, Lotte! Dankjewel voor je vertrouwen — we hopen je snel weer te mogen verwelkomen.”",
    },
  },
  {
    label: "3. Jij keurt goed",
    icon: CheckCheck,
    card: {
      title: "Goedgekeurd",
      body: "Eén klik en de reactie staat klaar om gepubliceerd te worden.",
    },
  },
  {
    label: "4. Reactie wordt geplaatst",
    icon: Send,
    card: {
      title: "Gepubliceerd op Google",
      body: "Je klant krijgt binnen enkele seconden een persoonlijk antwoord.",
    },
  },
];

export function ProductPreview() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setActive((n) => (n + 1) % steps.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="mkt-preview-card">
      <div className="mkt-preview-bar">
        <span className="mkt-preview-dot" />
        <span className="mkt-preview-dot" />
        <span className="mkt-preview-dot" />
        <span className="mkt-preview-title">Review AI · Mavix werkruimte</span>
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
