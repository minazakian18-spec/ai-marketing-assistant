"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus, Target } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { isBrowserDemo } from "@/lib/demo";
import { readiness } from "@/lib/instagram-model";
import { GOALS, change, goalProgress, nextActions, type Goal, type GoalKind, type SourceBlock } from "@/lib/insights";

// Measured results per source, the next three actions (rules over measured
// facts, labelled as suggestions) and simple monthly goals. Business research
// stays in its own section below; the SEO dashboard stays in SEO Intelligence.

const fmt = (v: number | null) => (v === null ? "—" : v.toLocaleString("nl-NL", { maximumFractionDigits: 1 }));

function Change({ value, previous }: { value: number | null; previous: number | null }) {
  const c = change({ label: "", value, previous });
  if (!c.direction) return <small className="ins-chg">geen vergelijking</small>;
  const Icon = c.direction === "up" ? ArrowUpRight : c.direction === "down" ? ArrowDownRight : Minus;
  return (
    <small className={"ins-chg is-" + c.direction}>
      <Icon size={13} aria-hidden="true" />
      {c.pct === null ? "nieuw" : (c.pct > 0 ? "+" : "") + c.pct + "%"} <span>(was {fmt(previous)})</span>
    </small>
  );
}

export function MarketingResults() {
  const { data, save } = useWorkspace();
  const demo = isBrowserDemo();
  const [blocks, setBlocks] = useState<SourceBlock[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<GoalKind | null>(null);
  const [target, setTarget] = useState("");

  useEffect(() => {
    if (demo) {
      setBlocks([{ id: "demo", source: "Testmodus", title: "Marketingresultaten", available: false, reason: "In de testmodus haalt Mavix geen gegevens op bij Google, Instagram of de e-mailprovider. Met een echt account zie je hier alleen gemeten cijfers.", href: "/account/integraties" }]);
      return;
    }
    fetch("/api/insights", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "De resultaten konden niet worden geladen.");
        setBlocks(d.blocks);
      })
      .catch((e) => setError((e as Error).message));
  }, [demo]);

  const now = new Date();
  const counts = useMemo(() => {
    const week = Date.now() + 7 * 86400_000;
    const items = [...data.posts, ...(data.email?.campaigns || [])];
    return {
      drafts: items.filter((i) => i.status === "draft").length,
      scheduledNext7: items.filter((i) => i.status === "scheduled" && i.date && Date.parse(i.date) <= week && Date.parse(i.date) >= Date.now()).length,
      brandScore: readiness(data.profile).score,
    };
  }, [data]);
  const actions = blocks ? nextActions(blocks, counts) : [];
  const rating = blocks?.find((b) => b.id === "reviews")?.metrics?.find((m) => m.label === "Gemiddelde score")?.value ?? null;
  const goals = data.goals || [];

  async function saveGoal(kind: GoalKind) {
    const def = GOALS.find((g) => g.kind === kind)!;
    const n = Number(target.replace(",", "."));
    if (!Number.isFinite(n) || n < def.min || n > def.max) return setError(`Kies een doel tussen ${def.min} en ${def.max}.`);
    const next: Goal[] = [...goals.filter((g) => g.kind !== kind), { kind, target: n }];
    if (await save({ ...data, goals: next }, "Doel opgeslagen")) setEditing(null);
  }
  async function removeGoal(kind: GoalKind) {
    await save({ ...data, goals: goals.filter((g) => g.kind !== kind) }, "Doel verwijderd");
  }

  return (
    <>
      <section className="ins-section" aria-labelledby="ins-next">
        <h2 id="ins-next">Wat nu?</h2>
        <p className="ins-sub">Suggesties van Mavix, gebaseerd op gemeten gegevens uit je werkruimte en koppelingen.</p>
        {actions.length ? (
          <ol className="ins-actions">
            {actions.map((a) => (
              <li key={a.title}>
                <div>
                  <strong>{a.title}</strong>
                  <small>{a.why}</small>
                </div>
                <Link href={a.href} className="button secondary">
                  {a.cta} <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="ins-sub">{blocks ? "Niets dringends. Goed bezig!" : "Laden…"}</p>
        )}
      </section>

      <section className="ins-section" aria-labelledby="ins-performance">
        <h2 id="ins-performance">Marketingresultaten</h2>
        <p className="ins-sub">Alleen gemeten cijfers, met de bron erbij. Waar een koppeling geen gegevens levert, staat waarom.</p>
        {error && !blocks ? (
          <p className="ins-error" role="alert">
            {error}
          </p>
        ) : !blocks ? (
          <div className="ins-skeleton" aria-busy="true" aria-label="Laden">
            <span />
            <span />
          </div>
        ) : (
          <div className="ins-blocks">
            {blocks.map((b) => (
              <article key={b.id} className={"ins-block" + (b.available ? "" : " is-empty")}>
                <header>
                  <h3>{b.title}</h3>
                  <span className={"ins-badge" + (b.available ? " is-measured" : "")}>{b.available ? "Gemeten · " + b.source : b.source}</span>
                </header>
                {b.available ? (
                  <>
                    <dl>
                      {b.metrics!.map((m) => (
                        <div key={m.label}>
                          <dt>{m.label}</dt>
                          <dd>{fmt(m.value)}</dd>
                          {m.previous !== null && <Change value={m.value} previous={m.previous} />}
                        </div>
                      ))}
                    </dl>
                    {b.period && <p className="ins-period">{b.period}</p>}
                  </>
                ) : (
                  <p className="ins-reason">{b.reason}</p>
                )}
                <Link href={b.href} className="text-link">
                  {b.available ? "Naar de module" : "Oplossen"} <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="ins-section" aria-labelledby="ins-goals">
        <h2 id="ins-goals">Doelen</h2>
        <p className="ins-sub">Kies tot drie doelen. De voortgang komt uit je echte gegevens van deze maand.</p>
        <ul className="ins-goals">
          {GOALS.map((def) => {
            const goal = goals.find((g) => g.kind === def.kind);
            const p = goal ? goalProgress(goal, { posts: data.posts, emails: data.email?.campaigns || [], rating }, now) : null;
            return (
              <li key={def.kind} className="ins-goal">
                <div className="ins-goal-head">
                  <Target size={15} aria-hidden="true" />
                  <strong>{def.label}</strong>
                </div>
                {editing === def.kind ? (
                  <div className="ins-goal-edit">
                    <label>
                      <span className="sr-only">Doel voor {def.label}</span>
                      <input type="number" inputMode="decimal" min={def.min} max={def.max} step={def.step} value={target} onChange={(e) => setTarget(e.target.value)} />
                    </label>
                    <span>{def.unit}</span>
                    <button type="button" className="button primary" onClick={() => void saveGoal(def.kind)}>
                      Opslaan
                    </button>
                    <button type="button" className="button secondary" onClick={() => setEditing(null)}>
                      Annuleren
                    </button>
                  </div>
                ) : goal && p ? (
                  <>
                    <div className="ins-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.pct ?? 0} aria-label={def.label}>
                      <span style={{ width: (p.pct ?? 0) + "%" }} />
                    </div>
                    <small>
                      {p.value === null ? "Nog geen gegevens" : `${fmt(p.value)} van ${fmt(goal.target)} ${def.unit}`} · {def.source}
                    </small>
                    <div className="ins-goal-actions">
                      <button type="button" className="text-button" onClick={() => (setEditing(def.kind), setTarget(String(goal.target)))}>
                        Aanpassen
                      </button>
                      <button type="button" className="text-button" onClick={() => void removeGoal(def.kind)}>
                        Verwijderen
                      </button>
                    </div>
                  </>
                ) : (
                  <button type="button" className="button secondary" onClick={() => (setEditing(def.kind), setTarget(String(def.kind === "review_rating" ? 4.5 : def.kind === "posts_per_month" ? 8 : 2)))}>
                    Doel kiezen
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {error && blocks && (
          <p className="ins-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </>
  );
}
