"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Adds `is-in` once the element scrolls into view, so a small UI demo (a
 * reply being written, a connection lighting up) plays once. Content is
 * fully visible without JS and under prefers-reduced-motion (CSS handles it).
 */
export function InView({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "article" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={className + " hs-demo" + (inView ? " is-in" : "")}>
      {children}
    </Tag>
  );
}
