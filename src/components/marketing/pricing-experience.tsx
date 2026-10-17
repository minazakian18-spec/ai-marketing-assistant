"use client";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { Check, ChevronDown, Clock, Minus, Sparkles } from "lucide-react";
import { ACTIONS, PLAN_IDS, PLANS, YEARLY_DISCOUNT_PERCENT, euro, yearlyPrice, type PlanId } from "@/lib/plans";
import { CATEGORIES, INFO, UPGRADE_PITCH, differs, upgradeBenefits, type Cell } from "@/lib/pricing-content";
import { InfoTip } from "./info-tip";

// Interactive part of /pricing: billing toggle, three plan cards, the plan
// finder, the credits example and the full comparison. Every value comes
// from the central plan configuration (src/lib/plans.ts).

const ctaHref = (id: PlanId) => "/aanvragen?plan=" + id;

function price(id: PlanId, yearly: boolean) {
  const p = PLANS[id];
  return yearly ? { main: euro(yearlyPrice(p).perMonth), note: `per maand · ${euro(yearlyPrice(p).perYear)} per jaar, vooraf gefactureerd` } : { main: euro(p.monthlyPrice), note: "per maand · maandelijks opzegbaar" };
}

function CellView({ v }: { v: Cell }) {
  if (v === true) return <Check size={17} className="pr-yes" aria-label="Inbegrepen" />;
  if (v === false) return <Minus size={17} className="pr-no" aria-label="Niet inbegrepen" />;
  if (v === "soon")
    return (
      <span className="pr-soon">
        <Clock size={11} aria-hidden="true" />
        <span className="pr-soon-text">Binnenkort</span>
      </span>
    );
  if (typeof v === "number") return <span className="pr-num">{v.toLocaleString("nl-NL")}</span>;
  return <span className="pr-text">{v}</span>;
}

export function PricingExperience({ yearlyAvailable }: { yearlyAvailable: boolean }) {
  const [yearly, setYearly] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(CATEGORIES.map((c) => [c.id, !!c.open])));
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [need, setNeed] = useState({ posts: 8, images: 4, reviews: 15, seo: false, advice: false, team: 1, agent: false });

  // Plan finder: the smallest plan whose real limits cover the answers.
  const advice = useMemo(() => {
    const fits = (id: PlanId) => {
      const p = PLANS[id];
      const credits = need.posts * ACTIONS.instagram_caption.credits + need.images * ACTIONS.image_generate.credits + need.reviews * ACTIONS.review_reply.credits;
      return (
        need.posts <= (p.limits.instagram_caption ?? Infinity) &&
        need.images <= (p.limits.image_generate ?? Infinity) &&
        need.reviews <= (p.limits.review_reply ?? Infinity) &&
        credits <= p.credits &&
        need.team <= p.users &&
        (!need.seo || p.entitlements.includes("seo_intelligence")) &&
        (!need.advice || p.entitlements.includes("advice_call")) &&
        (!need.agent || p.entitlements.includes("agent"))
      );
    };
    const id = PLAN_IDS.find(fits);
    return { id: id || "autopilot", fits: !!id };
  }, [need]);

  const allOpen = CATEGORIES.every((c) => open[c.id]);
  const g = PLANS.growth;
  const example = [
    { label: "13 Instagram-posts met nieuwe AI-afbeelding", n: 13, each: ACTIONS.instagram_caption.credits + ACTIONS.image_generate.credits },
    { label: "9 AI-e-mails", n: 9, each: ACTIONS.email_draft.credits },
    { label: "40 reviewantwoorden", n: 40, each: ACTIONS.review_reply.credits },
  ];
  const exampleTotal = example.reduce((s, e) => s + e.n * e.each, 0);

  return (
    <>
      {/* Billing period */}
      <div className="pr-period" role="group" aria-label="Factureringsperiode">
        <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>
          Maandelijks betalen
        </button>
        <button type="button" aria-pressed={yearly} disabled={!yearlyAvailable} onClick={() => setYearly(true)}>
          Jaarlijks betalen {yearlyAvailable && <span className="pr-save">−{YEARLY_DISCOUNT_PERCENT}%</span>}
        </button>
      </div>
      {!yearlyAvailable && <p className="pr-period-note">Jaarlijks betalen met {YEARLY_DISCOUNT_PERCENT}% korting komt binnenkort beschikbaar.</p>}

      {/* Plan cards */}
      <div className="pr-cards">
        {PLAN_IDS.map((id) => {
          const p = PLANS[id];
          const pr = price(id, yearly);
          return (
            <article key={id} className={"pr-card" + (p.recommended ? " is-recommended" : "")} aria-label={p.name}>
              {p.recommended && <span className="pr-badge">Aanbevolen</span>}
              <h3>{p.name}</h3>
              <p className="pr-audience">{p.audience}</p>
              <p className="pr-summary">{p.positioning}</p>
              <div className="pr-price">
                <strong>{pr.main}</strong>
                <span>{pr.note}</span>
              </div>
              <p className="pr-vat">Excl. btw</p>
              <p className="pr-credits">
                <Sparkles size={15} aria-hidden="true" /> {p.credits.toLocaleString("nl-NL")} AI-credits per maand
                <InfoTip label="AI-credits" text={INFO.credits} />
              </p>
              <ul>
                {p.highlights.map((h) => (
                  <li key={h}>
                    <Check size={15} aria-hidden="true" /> {h}
                  </li>
                ))}
              </ul>
              <Link href={ctaHref(id)} className={"mkt-btn " + (p.recommended ? "mkt-btn-primary" : "mkt-btn-secondary")}>
                Kies {p.name}
              </Link>
              <a href="#vergelijk" className="pr-all">
                Bekijk alle functies
              </a>
            </article>
          );
        })}
      </div>
      {/* Why upgrade: concrete differences, computed from the plan configuration */}
      <section className="pr-upgrades" aria-label="Wat je extra krijgt">
        {(
          [
            ["starter", "growth"],
            ["growth", "autopilot"],
          ] as const
        ).map(([from, to]) => {
          const u = upgradeBenefits(from, to);
          return (
            <article key={to} className={"pr-upgrade" + (PLANS[to].recommended ? " is-recommended" : "")}>
              <h3>Dit krijg je extra met {u.to.name}</h3>
              <p className="pr-upgrade-pitch">{UPGRADE_PITCH[to]}</p>
              <p className="pr-upgrade-price">
                {u.extraPerMonth} per maand meer dan {u.from.name}
              </p>
              <ul>
                {u.items.map((i) => (
                  <li key={i}>
                    <Check size={15} aria-hidden="true" /> {i}
                  </li>
                ))}
              </ul>
              <Link href={ctaHref(to)} className={"mkt-btn " + (PLANS[to].recommended ? "mkt-btn-primary" : "mkt-btn-secondary")}>
                Kies {u.to.name}
              </Link>
            </article>
          );
        })}
      </section>
      <p className="pr-beta-note">Mavix is in besloten beta. Je kiest een pakket bij je aanvraag; na een persoonlijke kennismaking zetten we je werkruimte klaar. Er wordt pas iets afgeschreven als betaalde abonnementen openen.</p>

      {/* Plan finder */}
      <section className="pr-finder" aria-labelledby="pr-finder-title">
        <h2 id="pr-finder-title">Welk pakket past bij mij?</h2>
        <p>Vul in wat je per maand verwacht. De aanbeveling volgt uit de echte limieten van de pakketten.</p>
        <div className="pr-finder-grid">
          {(
            [
              ["posts", "Instagram-posts per maand", 60],
              ["images", "Nieuwe AI-afbeeldingen per maand", 40],
              ["reviews", "Reviews die je beantwoordt per maand", 200],
              ["team", "Gebruikers", 5],
            ] as const
          ).map(([k, label, max]) => (
            <label key={k} className="pr-range">
              <span>
                {label} <strong>{need[k]}</strong>
              </span>
              <input type="range" min={k === "team" ? 1 : 0} max={max} value={need[k]} onChange={(e) => setNeed({ ...need, [k]: Number(e.target.value) })} />
            </label>
          ))}
          {(
            [
              ["seo", "Ik wil SEO Intelligence met AI-adviezen"],
              ["agent", "Ik wil de Mavix Agent gebruiken"],
              ["advice", "Ik wil persoonlijk marketingadvies"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="pr-check">
              <input type="checkbox" checked={need[k]} onChange={(e) => setNeed({ ...need, [k]: e.target.checked })} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <div className="pr-finder-result" role="status" aria-live="polite">
          <span>
            {advice.fits ? "Advies:" : "Je wensen gaan verder dan Premium. Neem contact met ons op; tot die tijd past het best:"} <strong>{PLANS[advice.id].name}</strong> ({euro(PLANS[advice.id].monthlyPrice)} per maand)
          </span>
          <Link href={ctaHref(advice.id)} className="mkt-btn mkt-btn-primary">
            Kies {PLANS[advice.id].name}
          </Link>
        </div>
      </section>

      {/* Credits explained */}
      <section className="pr-credits-box" aria-labelledby="pr-credits-title">
        <h2 id="pr-credits-title">Zo werken AI-credits</h2>
        <p>
          Met {g.name} ontvang je {g.credits} AI-credits per maand. Je kunt daarmee onder andere maximaal {g.limits.image_generate} AI-afbeeldingen en {g.limits.instagram_caption} Instagram-captions maken. Iedere actie gebruikt credits uit hetzelfde maandtegoed.
        </p>
        <div className="pr-credit-grid">
          <table className="pr-credit-table">
            <caption>Credits per AI-actie</caption>
            <tbody>
              {(["instagram_caption", "review_reply", "email_draft", "image_generate", "image_edit", "inbox_reply", "seo_advice", "campaign", "research", "agent_task", "brand_improve"] as const).map((a) => (
                <tr key={a}>
                  <th scope="row">{ACTIONS[a].label.replace(/^AI-/, "")}</th>
                  <td>{ACTIONS[a].credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pr-example">
            <strong>Rekenvoorbeeld met {g.name}</strong>
            <ul>
              {example.map((e) => (
                <li key={e.label}>
                  <span>{e.label}</span>
                  <span>
                    {e.n} × {e.each} = {e.n * e.each} credits
                  </span>
                </li>
              ))}
              <li className="pr-example-total">
                <span>Totaal</span>
                <span>{exampleTotal} credits</span>
              </li>
              <li>
                <span>Nog over</span>
                <span>{g.credits - exampleTotal} credits</span>
              </li>
            </ul>
            <small>Een voorbeeld, geen vaste verdeling of garantie. De maandmaxima per functie gelden altijd. Is je tegoed op, dan stoppen nieuwe AI-acties tot je tegoed vernieuwt; je content blijft bewaard en er worden nooit automatisch extra credits afgerekend.</small>
          </div>
        </div>
      </section>

      {/* Full comparison */}
      <section className="pr-compare" id="vergelijk" aria-labelledby="pr-compare-title">
        <div className="pr-compare-head">
          <div>
            <h2 id="pr-compare-title">Vergelijk alle Mavix-abonnementen</h2>
            <p>Ontdek alle functies en mogelijkheden. Bekijk precies wat je extra krijgt wanneer je kiest voor Growth of Premium.</p>
          </div>
          <div className="pr-compare-tools">
            <label className="pr-switch">
              <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
              <span>Toon alleen verschillen</span>
            </label>
            <button type="button" className="pr-link" onClick={() => setOpen(Object.fromEntries(CATEGORIES.map((c) => [c.id, !allOpen])))}>
              {allOpen ? "Toon minder" : "Toon alle functies"}
            </button>
          </div>
        </div>
        <p className="pr-legend">
          <span>
            <Check size={14} className="pr-yes" aria-hidden="true" /> Inbegrepen
          </span>
          <span>
            <Minus size={14} className="pr-no" aria-hidden="true" /> Niet in dit pakket
          </span>
          <span>
            <span className="pr-soon">
              <Clock size={11} aria-hidden="true" /> Binnenkort
            </span>{" "}
            Nog niet beschikbaar, in ontwikkeling
          </span>
        </p>
        <div className="pr-table-wrap" tabIndex={0} aria-label="Vergelijkingstabel, horizontaal scrollbaar op kleine schermen">
          <table className="pr-table">
            <thead>
              <tr>
                <th scope="col" className="pr-feature-col">
                  Functie
                </th>
                {PLAN_IDS.map((id) => (
                  <th scope="col" key={id} className={PLANS[id].recommended ? "is-recommended" : ""}>
                    <span className="pr-th-name">{PLANS[id].name}</span>
                    <span className="pr-th-price">
                      {price(id, yearly).main}
                      <small> /mnd</small>
                    </span>
                    <Link href={ctaHref(id)} className="pr-th-cta">
                      Kies
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((c) => {
                const rows = onlyDiff ? c.rows.filter(differs) : c.rows;
                if (!rows.length) return null;
                const isOpen = open[c.id] || onlyDiff;
                return (
                  <Fragment key={c.id}>
                    <tr className="pr-cat">
                      <th colSpan={4} scope="colgroup">
                        <button type="button" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [c.id]: !open[c.id] })} disabled={onlyDiff}>
                          {c.title}
                          <small>{rows.length}</small>
                          <ChevronDown size={16} aria-hidden="true" />
                        </button>
                      </th>
                    </tr>
                    {isOpen &&
                      rows.map((r) => (
                        <tr key={c.id + r.label} className="pr-row">
                          <th scope="row" className="pr-feature-col">
                            <span>{r.label}</span>
                            {r.info && <InfoTip label={r.label} text={r.info} />}
                          </th>
                          {PLAN_IDS.map((id) => (
                            <td key={id} className={PLANS[id].recommended ? "is-recommended" : ""}>
                              <CellView v={r.values[id]} />
                            </td>
                          ))}
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="pr-scroll-hint">Schuif de tabel opzij om alle pakketten te zien.</p>
      </section>
    </>
  );
}
