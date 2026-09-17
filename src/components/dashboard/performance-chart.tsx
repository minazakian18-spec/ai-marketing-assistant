"use client";
import { useId, useState } from "react";
import { TrendingUp } from "lucide-react";
import {
  performance,
  chartValues,
  number,
  type Channel,
  type Period,
} from "@/lib/dashboard-data";
export function PerformanceChart() {
  const [period, setPeriod] = useState<Period>(30);
  const [channel, setChannel] = useState<Channel>("Overzicht");
  const [metric, setMetric] = useState(0);
  const id = useId().replaceAll(":", "");
  const stats = performance(channel, period),
    values = chartValues(channel, period, metric);
  const max = Math.ceil(Math.max(...values) * 1.18);
  const points = values.map((v, i) => [
    54 + i * (766 / (values.length - 1)),
    210 - (v / max) * 174,
  ]);
  const line = points
    .map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1))
    .join(" ");
  const area = line + " L820 210 L54 210 Z";
  const labels = [
    period + " dagen geleden",
    Math.round(period / 2) + " dagen geleden",
    "Vandaag",
  ];
  return (
    <section
      className="panel performance-panel"
      aria-labelledby="performance-title"
    >
      <div className="dash-section-head">
        <div>
          <h2 id="performance-title">Marketingprestatie</h2>
          <p>Een helder beeld van je marketing.</p>
        </div>
        <div className="dash-segment" role="group" aria-label="Periode">
          {([7, 30, 90] as const).map((p) => (
            <button
              key={p}
              aria-pressed={p === period}
              onClick={() => setPeriod(p)}
            >
              {p} dagen
            </button>
          ))}
        </div>
      </div>
      <div className="performance-tabs" role="group" aria-label="Kanaal">
        {(["Overzicht", "Instagram", "E-mail"] as const).map((c) => (
          <button
            key={c}
            aria-pressed={channel === c}
            onClick={() => {
              setChannel(c);
              setMetric(0);
            }}
          >
            {c}
          </button>
        ))}
        <span>Mockdata</span>
      </div>
      <div className="chart-summaries" role="group" aria-label="Grafiekmetric">
        {stats.map((s, i) => (
          <button
            key={s.label}
            aria-pressed={metric === i}
            onClick={() => setMetric(i)}
          >
            <span>{s.label}</span>
            <strong>
              {number(s.value)}
              {s.suffix}
            </strong>
            <small>
              <TrendingUp size={12} />
              {s.trend} <span>vs vorige periode</span>
            </small>
          </button>
        ))}
      </div>
      <figure className="performance-figure">
        <svg
          viewBox="0 0 850 250"
          role="img"
          aria-label={
            channel +
            ": " +
            stats[metric].label +
            " over " +
            period +
            " dagen, voorbeeldgrafiek"
          }
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8d7be1" stopOpacity=".2" />
              <stop offset="100%" stopColor="#8d7be1" stopOpacity=".015" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <line
                x1="54"
                x2="820"
                y1={36 + i * 58}
                y2={36 + i * 58}
                stroke="#eeedf4"
                strokeDasharray="4 5"
              />
              <text
                x="42"
                y={40 + i * 58}
                textAnchor="end"
                fill="#9899aa"
                fontSize="11"
              >
                {number(Math.round(max * (1 - i / 3) * 10) / 10)}
              </text>
            </g>
          ))}
          <path d={area} fill={"url(#" + id + ")"} />
          <path
            key={channel + period + metric}
            className="motion-chart-line"
            pathLength={1}
            d={line}
            fill="none"
            stroke="#8270d9"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {labels.map((label, i) => (
            <text
              key={label}
              x={[54, 437, 820][i]}
              y="240"
              textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
              fill="#9899aa"
              fontSize="11"
            >
              {label}
            </text>
          ))}
        </svg>
        <figcaption>
          {stats[metric].label} · {channel} · laatste {period} dagen.
          Illustratieve meetpunten; geen live metingen.
        </figcaption>
      </figure>
    </section>
  );
}
