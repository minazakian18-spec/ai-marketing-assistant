"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Fades/slides an element in once it scrolls into view. No-ops entirely under reduced motion. */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={"mkt-reveal " + (visible ? "mkt-reveal-in" : "") + " " + className}
      style={{ transitionDelay: visible ? delay + "ms" : "0ms" }}
    >
      {children}
    </div>
  );
}
