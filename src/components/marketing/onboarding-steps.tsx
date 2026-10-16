import Link from "next/link";
import { Reveal } from "./reveal";

// The closed onboarding as it really works: nobody gets an active workspace
// without a personal review. Shown on the homepage so visitors know what
// happens after they apply.
const STEPS = [
  ["Aanvraag", "Je vraagt een demo of account aan. Dat kost twee minuten."],
  ["Persoonlijke beoordeling", "We bekijken je aanvraag en nemen contact met je op."],
  ["Demo of kennismaking", "We laten zien hoe Mavix werkt voor jouw zaak."],
  ["Goedkeuring en start", "Je werkruimte gaat open. Je vult je Brand Hub in en koppelt je kanalen, stap voor stap."],
] as const;

export function OnboardingSteps() {
  return (
    <section className="mkt-section-tight" aria-labelledby="mkt-onboarding">
      <div className="mkt-container">
        <Reveal className="mkt-section-head">
          <span className="mkt-eyebrow">Zo start je</span>
          <h2 className="mkt-h2" id="mkt-onboarding">
            Van aanvraag tot je eerste campagne.
          </h2>
        </Reveal>
        <Reveal>
          <ol className="mkt-onboarding">
            {STEPS.map(([title, text], i) => (
              <li key={title}>
                <span className="mkt-step-number">{i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </Reveal>
        <Reveal delay={300}>
          <p className="mkt-onboarding-note">
            Mavix is in besloten beta: je betaalt nu niets. <Link href="/aanvragen">Account aanvragen</Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
