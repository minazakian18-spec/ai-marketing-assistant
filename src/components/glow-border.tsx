"use client";
import { useEffect, useRef, type CSSProperties } from "react";

// Soft light gliding around the rounded border of an AI input (dashboard and
// Mavix Agent). Styles: "glow-border" in motion.css.
//
// An SVG rect lies on the border's centre line. The light is a set of dashes
// on that rect, all centred on the same point and of decreasing length, so
// their light adds up to a long highlight that is brightest in the middle and
// fades out at both ends. A CSS animation moves the dashes along the rect: the
// light follows the real perimeter, corners included, at a constant speed.
// A second, blurred set gives the soft glow around it.
//
// JS only measures: a ResizeObserver updates size, corner radius and the
// perimeter (--gb-perimeter) when the input resizes. No per-frame work.
const LINE = Array.from({ length: 10 }, (_, i) => 1 - i * 0.09);
const GLOW = [1, 0.75, 0.5, 0.3];

function Steps({ parts, kind }: { parts: number[]; kind: string }) {
  return (
    <g className={"gb-" + kind}>
      {parts.map((part) => (
        <rect key={part} x="0.5" y="0.5" style={{ "--gb-part": part } as CSSProperties} />
      ))}
    </g>
  );
}

export function GlowBorder() {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    const host = svg?.parentElement;
    if (!svg || !host) return;
    const update = () => {
      const box = host.getBoundingClientRect();
      const w = Math.max(0, box.width - 1);
      const h = Math.max(0, box.height - 1);
      const outer = parseFloat(getComputedStyle(host).borderTopLeftRadius) || 0;
      const r = Math.min(Math.max(0, outer - 0.5), w / 2, h / 2);
      for (const rect of svg.querySelectorAll("rect")) {
        rect.setAttribute("width", String(w));
        rect.setAttribute("height", String(h));
        rect.setAttribute("rx", String(r));
      }
      svg.style.setProperty("--gb-perimeter", `${2 * (w + h) - 8 * r + 2 * Math.PI * r}px`);
      svg.dataset.ready = "";
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <svg ref={ref} className="glow-border" aria-hidden="true" focusable="false">
      <Steps parts={GLOW} kind="glow" />
      <Steps parts={LINE} kind="line" />
    </svg>
  );
}
