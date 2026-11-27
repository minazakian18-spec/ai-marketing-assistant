"use client";
import { useEffect, useRef } from "react";

// The Mavix mark as a slowly turning glossy object on the Agent welcome
// screen. Drag it with the mouse or a finger to spin it; it keeps turning on
// its own afterwards. Reduced motion: a still mark.
export function MavixOrb({ size = 96 }: { size?: number }) {
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let rx = -12, ry = 20, vx = 0, vy = 0.35, drag = false, lastX = 0, lastY = 0, frame = 0;
    const paint = () => {
      el.style.setProperty("--rx", rx.toFixed(2) + "deg");
      el.style.setProperty("--ry", ry.toFixed(2) + "deg");
    };
    const tick = () => {
      if (!drag) {
        // Ease back to a gentle idle spin and a slight tilt.
        vy += (0.35 - vy) * 0.02;
        vx += ((-12 - rx) * 0.002 - vx) * 0.05;
        ry += vy;
        rx += vx;
      }
      paint();
      frame = requestAnimationFrame(tick);
    };
    const down = (e: PointerEvent) => {
      drag = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      vy = dx * 0.6;
      vx = -dy * 0.6;
      ry += vy;
      rx = Math.max(-60, Math.min(60, rx + vx));
      paint();
    };
    const up = () => (drag = false);
    paint();
    if (!still) frame = requestAnimationFrame(tick);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, []);
  return (
    <div className="mx-orb" ref={stage} style={{ width: size, height: size }} aria-hidden="true">
      <div className="mx-orb-body">
        {/* eslint-disable-next-line @next/next/no-img-element -- local SVG mark */}
        <img src="/mavix-mark.svg" alt="" draggable={false} className="mx-orb-front" />
        {/* eslint-disable-next-line @next/next/no-img-element -- local SVG mark */}
        <img src="/mavix-mark.svg" alt="" draggable={false} className="mx-orb-back" />
      </div>
      <span className="mx-orb-shadow" />
    </div>
  );
}
