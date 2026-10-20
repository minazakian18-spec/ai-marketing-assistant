import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL, LEGAL_PAGES } from "@/lib/legal";

export type LegalSection = { id: string; title: string; body: ReactNode };

/** A missing company detail, shown honestly instead of invented. */
export function Pending({ children }: { children: ReactNode }) {
  return <span className="lg-pending">{children}</span>;
}

/** Who is responsible, with only the details that are confirmed. */
export function Controller() {
  return (
    <ul className="lg-facts">
      <li>
        <strong>Onderneming:</strong> {LEGAL.entity ?? <Pending>De juridische naam van de onderneming achter Mavix wordt hier vermeld.</Pending>}
      </li>
      <li>
        <strong>KvK-nummer:</strong> {LEGAL.kvk ?? <Pending>Volgt.</Pending>}
      </li>
      <li>
        <strong>Adres:</strong> {LEGAL.address ?? <Pending>Volgt.</Pending>}
      </li>
      <li>
        <strong>Privacycontact:</strong>{" "}
        {LEGAL.privacyEmail ? <a href={"mailto:" + LEGAL.privacyEmail}>{LEGAL.privacyEmail}</a> : <Pending>Een e-mailadres voor privacyvragen volgt. Heb je een account, gebruik dan Account → Beveiliging en privacy.</Pending>}
      </li>
    </ul>
  );
}

export function LegalDocument({ title, intro, sections, current }: { title: string; intro: ReactNode; sections: LegalSection[]; current: string }) {
  return (
    <main className="lg">
      <div className="mkt-container lg-wrap">
        <header className="lg-head">
          <span className="mkt-eyebrow">Juridisch</span>
          <h1>{title}</h1>
          <p className="lg-intro">{intro}</p>
          <p className="lg-meta">Laatst bijgewerkt: {LEGAL.updated}</p>
          <p className="lg-draft">Mavix is in besloten beta. Deze tekst is een zorgvuldig opgesteld concept en wordt vóór de commerciële lancering juridisch gecontroleerd. Waar een gegeven nog ontbreekt, staat dat er eerlijk bij.</p>
        </header>
        <div className="lg-layout">
          <nav className="lg-toc" aria-label="Inhoud van deze pagina">
            <p>Inhoud</p>
            <ol>
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={"#" + s.id}>{s.title}</a>
                </li>
              ))}
            </ol>
          </nav>
          <article className="lg-body">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={s.id + "-t"}>
                <h2 id={s.id + "-t"}>
                  <span>{i + 1}.</span> {s.title}
                </h2>
                {s.body}
              </section>
            ))}
          </article>
        </div>
        <nav className="lg-related" aria-label="Andere juridische pagina's">
          {LEGAL_PAGES.filter((p) => p.href !== current).map((p) => (
            <Link key={p.href} href={p.href}>
              {p.label}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
