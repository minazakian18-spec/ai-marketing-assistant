import { Fragment, type ReactNode } from "react";
import Link from "next/link";

// Small, safe Markdown renderer for Mavix Agent answers. It builds React
// elements only (no HTML strings, no dangerouslySetInnerHTML), so text from
// the model can never inject markup. Supported: headings, paragraphs, bullet
// and numbered lists, fenced code, inline code, bold, italic, links and
// simple tables. Links are allowed only to http(s), mailto and in-app paths.

const SAFE_HREF = /^(https?:\/\/|mailto:|\/(?!\/))/i;

function inline(text: string, key = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  // Order matters: code first (its content is literal), then links, bold, italic, bare URLs.
  const re = /(`[^`\n]+`)|\[([^\]\n]{1,200})\]\(([^)\s]{1,500})\)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*|_[^_\n]+_)|(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${n++}`;
    if (m[1]) out.push(<code key={k}>{m[1].slice(1, -1)}</code>);
    else if (m[2] && m[3]) {
      const href = m[3];
      if (!SAFE_HREF.test(href)) out.push(m[2]);
      else if (href.startsWith("/")) out.push(<Link key={k} href={href}>{inline(m[2], k)}</Link>);
      else
        out.push(
          <a key={k} href={href} target="_blank" rel="noopener noreferrer nofollow">
            {inline(m[2], k)}
          </a>,
        );
    } else if (m[4]) out.push(<strong key={k}>{inline(m[4].slice(2, -2), k)}</strong>);
    else if (m[5]) out.push(<em key={k}>{inline(m[5].slice(1, -1), k)}</em>);
    else if (m[6])
      out.push(
        <a key={k} href={m[6]} target="_blank" rel="noopener noreferrer nofollow">
          {m[6]}
        </a>,
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let b = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = "b" + b++;
    if (/^\s*```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={key}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const content = inline(h[2], key);
      blocks.push(level <= 2 ? <h3 key={key}>{content}</h3> : <h4 key={key}>{content}</h4>);
      i++;
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      blocks.push(
        <div key={key} className="md-table">
          <table>
            <thead>
              <tr>
                {head.map((c, j) => (
                  <th key={j}>{inline(c, key + j)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {head.map((_, j) => (
                    <td key={j}>{inline(r[j] || "", `${key}-${ri}-${j}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const bullet = /^\s*[-*•]\s+/;
    const numbered = /^\s*\d+[.)]\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const pattern = ordered ? numbered : bullet;
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i])) items.push(lines[i++].replace(pattern, ""));
      const list = items.map((it, j) => <li key={j}>{inline(it, `${key}-${j}`)}</li>);
      blocks.push(ordered ? <ol key={key}>{list}</ol> : <ul key={key}>{list}</ul>);
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*```|\s*[-*•]\s|\s*\d+[.)]\s|\s*\|)/.test(lines[i])) para.push(lines[i++]);
    if (!para.length) para.push(lines[i++]);
    blocks.push(
      <p key={key}>
        {para.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(p, `${key}-${j}`)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <div className="md">{blocks}</div>;
}
