"use client";
import { useEffect } from "react";

/**
 * Fresh page loads with a fragment (e.g. /#product): the browser's own jump
 * is unreliable here, because smooth scrolling on <html> gets interrupted by
 * hydration and late layout. Once the page has loaded, jump to the target
 * instantly (scroll-padding-top keeps it clear of the header) and correct
 * once more if the layout still moved. In-page navigation is untouched.
 */
export function HashScroll() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    let cancelled = false;
    const userScrolled = () => (cancelled = true);
    window.addEventListener("wheel", userScrolled, { passive: true, once: true });
    window.addEventListener("touchmove", userScrolled, { passive: true, once: true });
    window.addEventListener("keydown", userScrolled, { once: true });
    const jump = () => {
      const el = document.getElementById(id);
      if (!el || cancelled) return;
      const root = document.documentElement;
      const previous = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      el.scrollIntoView({ block: "start" });
      root.style.scrollBehavior = previous;
    };
    const run = () => {
      jump();
      // Images and fonts can still shift the layout shortly after load.
      setTimeout(jump, 350);
    };
    const ready = () => (document.fonts ? document.fonts.ready.then(run) : run());
    if (document.readyState === "complete") ready();
    else window.addEventListener("load", ready, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", ready);
      window.removeEventListener("wheel", userScrolled);
      window.removeEventListener("touchmove", userScrolled);
      window.removeEventListener("keydown", userScrolled);
    };
  }, []);
  return null;
}
