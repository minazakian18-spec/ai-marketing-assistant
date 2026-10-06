"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Subtle fade-in for content below the fold. Content is visible in the
 * server-rendered HTML (crawlers, no-JS, fast LCP); only elements that are
 * still off-screen after hydration are hidden and revealed when scrolled
 * into view. Does nothing under prefers-reduced-motion.
 */
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
  const [state, setState] = useState<"static" | "hidden" | "in">("static");
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    setState("hidden");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState("in");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={(state === "static" ? "" : "mkt-reveal" + (state === "in" ? " mkt-reveal-in" : "")) + " " + className}
      style={state === "in" && delay ? { transitionDelay: Math.min(delay, 160) + "ms" } : undefined}
    >
      {children}
    </div>
  );
}
