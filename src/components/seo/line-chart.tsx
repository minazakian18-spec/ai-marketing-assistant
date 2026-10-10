"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";

// Small SVG line chart: one y-axis, thin 2px lines, recessive grid, crosshair
// + tooltip on hover/focus, legend for 2+ series with direct end labels, and a
// table view. Colours are validated categorical slots (see seo.css).

export type Series = { key: string; label: string; color: string };
export type Point = { x: string; label: string; values: Record<string, number | null> };

export function LineChart({
  title,
  points,
  series,
  yMax,
  format = (v) => String(v),
  height = 220,
}: {
  title: string;
  points: Point[];
  series: Series[];
  yMax?: number;
  format?: (v: number) => string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  // Drawn at the real width (no stretching), so text keeps its size.
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [table]);
  const H = height;
  const pad = { l: 40, r: series.length > 1 && W >= 480 ? 118 : 16, t: 12, b: 28 };
  const max = useMemo(() => {
    if (yMax !== undefined) return yMax;
    const m = Math.max(0, ...points.flatMap((p) => series.map((s) => p.values[s.key] ?? 0)));
    if (m <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(m)));
    return Math.ceil(m / mag) * mag;
  }, [points, series, yMax]);
  const x = (i: number) => pad.l + (points.length <= 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1));
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(W / 110))));

  function move(clientX: number) {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || !points.length) return;
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    setHover(best);
  }

  // Direct labels at the line ends, nudged apart so they never overlap.
  const ends = series
    .map((s) => {
      for (let i = points.length - 1; i >= 0; i--) {
        const v = points[i].values[s.key];
        if (v !== null && v !== undefined) return { s, i, v, y: y(v) };
      }
      return null;
    })
    .filter((e): e is { s: Series; i: number; v: number; y: number } => !!e)
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;

  return (
    <figure className="seo-chart" aria-labelledby={id}>
      <figcaption id={id}>
        <span>{title}</span>
        <button type="button" className="seo-chart-toggle" onClick={() => setTable((t) => !t)} aria-pressed={table}>
          {table ? "Grafiek" : "Tabel"}
        </button>
      </figcaption>
      {series.length > 1 && (
        <ul className="seo-legend">
          {series.map((s) => (
            <li key={s.key}>
              <span className="seo-legend-swatch" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      {table ? (
        <div className="seo-table-wrap">
          <table className="seo-table">
            <thead>
              <tr>
                <th scope="col">Datum</th>
                {series.map((s) => (
                  <th key={s.key} scope="col">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.x}>
                  <th scope="row">{p.label}</th>
                  {series.map((s) => (
                    <td key={s.key}>{p.values[s.key] === null || p.values[s.key] === undefined ? "—" : format(p.values[s.key]!)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="seo-chart-plot"
          ref={box}
          onMouseMove={(e) => move(e.clientX)}
          onMouseLeave={() => setHover(null)}
          tabIndex={0}
          role="group"
          aria-label={title + ": gebruik de pijltjestoetsen om waarden te lezen"}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") setHover((h) => Math.min(points.length - 1, (h ?? -1) + 1));
            if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? points.length) - 1));
            if (e.key === "Escape") setHover(null);
          }}
          onBlur={() => setHover(null)}
        >
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
            {ticks.map((t) => (
              <g key={t}>
                <line className="seo-grid" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
                <text className="seo-axis" x={pad.l - 6} y={y(t) + 4} textAnchor="end">
                  {format(Math.round(t))}
                </text>
              </g>
            ))}
            {points.map((p, i) =>
              i % labelEvery === 0 || i === points.length - 1 ? (
                <text key={p.x} className="seo-axis" x={x(i)} y={H - 8} textAnchor="middle">
                  {p.label}
                </text>
              ) : null,
            )}
            {series.map((s) => {
              const segs: string[] = [];
              let d = "";
              points.forEach((p, i) => {
                const v = p.values[s.key];
                if (v === null || v === undefined) {
                  if (d) segs.push(d);
                  d = "";
                  return;
                }
                d += (d ? " L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1);
              });
              if (d) segs.push(d);
              return (
                <g key={s.key}>
                  {segs.map((path, i) => (
                    <path key={i} d={path} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  ))}
                  {points.length === 1 && points[0].values[s.key] !== null && points[0].values[s.key] !== undefined && (
                    <circle cx={x(0)} cy={y(points[0].values[s.key]!)} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
                  )}
                </g>
              );
            })}
            {series.length > 1 &&
              W >= 480 &&
              ends.map((e) => (
                <text key={e.s.key} className="seo-end-label" x={W - pad.r + 8} y={e.y + 4}>
                  {e.s.label} {format(e.v)}
                </text>
              ))}
            {hover !== null && (
              <g>
                <line className="seo-crosshair" x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} />
                {series.map((s) => {
                  const v = points[hover]?.values[s.key];
                  return v === null || v === undefined ? null : <circle key={s.key} cx={x(hover)} cy={y(v)} r={4.5} fill={s.color} stroke="#fff" strokeWidth={2} />;
                })}
              </g>
            )}
          </svg>
          {hover !== null && points[hover] && (
            <div className="seo-tooltip" style={{ left: `${(x(hover) / W) * 100}%` }} role="status">
              <strong>{points[hover].label}</strong>
              {series.map((s) => (
                <span key={s.key}>
                  <i style={{ background: s.color }} aria-hidden="true" />
                  {s.label}: {points[hover].values[s.key] === null || points[hover].values[s.key] === undefined ? "—" : format(points[hover].values[s.key]!)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
