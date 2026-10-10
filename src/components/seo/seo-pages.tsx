"use client";
import { Fragment, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { StoredPage } from "@/lib/seo/types";
import { pathOf } from "./seo-parts";

// Every page Mavix analysed, with the measured facts.

const ok = (p: StoredPage) => p.status >= 200 && p.status < 300;
function flags(p: StoredPage) {
  const f: string[] = [];
  if (!ok(p)) f.push("Foutcode " + p.status);
  if (ok(p) && !p.title) f.push("Geen titel");
  if (ok(p) && !p.metaDescription) f.push("Geen beschrijving");
  if (ok(p) && p.h1.length !== 1) f.push(p.h1.length ? `${p.h1.length} H1's` : "Geen H1");
  if (p.noindex) f.push("noindex");
  if (p.imagesMissingAlt) f.push(`${p.imagesMissingAlt} zonder alt`);
  return f;
}

export function Pages({ pages }: { pages: StoredPage[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!pages.length)
    return (
      <div className="seo-empty">
        <strong>Geen pagina&apos;s geanalyseerd</strong>
        <p>De website was niet bereikbaar of robots.txt verbood het bekijken van pagina&apos;s.</p>
      </div>
    );
  return (
    <div className="seo-table-wrap">
      <table className="seo-table seo-pages">
        <thead>
          <tr>
            <th scope="col">Pagina</th>
            <th scope="col">Status</th>
            <th scope="col">Titel</th>
            <th scope="col">Woorden</th>
            <th scope="col">Aandachtspunten</th>
          </tr>
        </thead>
        <tbody>
          {pages.map((p) => {
            const f = flags(p);
            const expanded = open === p.url;
            return (
              <Fragment key={p.url}>
                <tr className={expanded ? "is-current" : ""}>
                  <th scope="row" className="seo-cell-text">
                    <button type="button" className="seo-link-button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : p.url)}>
                      {pathOf(p.url)}
                    </button>
                  </th>
                  <td>
                    <span className={"seo-status" + (ok(p) ? "" : " is-bad")}>{p.status}</span>
                  </td>
                  <td className="seo-cell-text">{p.title || "—"}</td>
                  <td>{ok(p) ? p.wordCount : "—"}</td>
                  <td>{f.length ? <span className="seo-flags">{f.join(" · ")}</span> : <span className="seo-tone is-good">In orde</span>}</td>
                </tr>
                {expanded && (
                  <tr className="seo-page-detail">
                    <td colSpan={5}>
                      <dl>
                        <dt>URL</dt>
                        <dd>
                          <a href={p.url} target="_blank" rel="noopener noreferrer nofollow">
                            {p.url} <ExternalLink size={12} aria-hidden="true" />
                          </a>
                        </dd>
                        <dt>Titel ({p.title.length} tekens)</dt>
                        <dd>{p.title || "—"}</dd>
                        <dt>Metabeschrijving ({p.metaDescription.length} tekens)</dt>
                        <dd>{p.metaDescription || "—"}</dd>
                        <dt>H1</dt>
                        <dd>{p.h1.length ? p.h1.join(" | ") : "—"}</dd>
                        <dt>Canonical</dt>
                        <dd>{p.canonical || "—"}</dd>
                        <dt>Indexering</dt>
                        <dd>{p.noindex ? "noindex (niet in Google)" : "Mag in Google"}{p.robotsMeta ? ` · robots: ${p.robotsMeta}` : ""}</dd>
                        <dt>Doorverwijzingen</dt>
                        <dd>{p.redirects.length ? p.redirects.map((r) => `${r.status} ${pathOf(r.url)}`).join(" → ") + " → " + pathOf(p.url) : "Geen"}</dd>
                        <dt>Gestructureerde data</dt>
                        <dd>{p.structuredData.length ? p.structuredData.join(", ") : "Geen"}</dd>
                        <dt>Afbeeldingen</dt>
                        <dd>
                          {p.images} totaal, {p.imagesMissingAlt} zonder alt
                        </dd>
                        <dt>Links</dt>
                        <dd>
                          {p.internalLinkCount} intern, {p.externalLinkCount} extern
                        </dd>
                        <dt>Taal / viewport</dt>
                        <dd>
                          {p.lang || "geen lang"} · {p.viewport || "geen viewport"}
                        </dd>
                        <dt>Laadtijd (server)</dt>
                        <dd>
                          {p.loadMs} ms · {Math.round(p.bytes / 1024)} kB HTML
                        </dd>
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
