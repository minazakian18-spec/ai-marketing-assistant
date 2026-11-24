"use client";
import { useEffect, useState } from "react";

// Account > Weergave: licht, donker or paars. Stored per browser in the
// mavix-theme cookie; src/app/(app)/layout.tsx renders it as the #mavix-theme
// flag that src/app/theme.css styles from, so it applies at once.
export const THEMES = [
  { id: "licht", label: "Licht", text: "Rustig en helder, de standaard." },
  { id: "donker", label: "Donker", text: "Prettig voor je ogen, 's avonds of in een donkere ruimte." },
  { id: "paars", label: "Paars", text: "De Mavix-kleuren: een paarse zijbalk op een zachte achtergrond." },
] as const;
export type Theme = (typeof THEMES)[number]["id"];

export function ThemePicker() {
  const [theme, setTheme] = useState<Theme>("licht");
  useEffect(() => {
    const t = document.getElementById("mavix-theme")?.dataset.themeFlag as Theme | undefined;
    if (t && THEMES.some((x) => x.id === t)) setTheme(t);
  }, []);

  function choose(t: Theme) {
    setTheme(t);
    const flag = document.getElementById("mavix-theme");
    if (flag) flag.dataset.themeFlag = t;
    // eslint-disable-next-line react-hooks/immutability -- writing the browser cookie is the point here
    document.cookie = `mavix-theme=${t}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="theme-picker" role="radiogroup" aria-label="Weergave">
      {THEMES.map((t) => (
        <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} className="theme-option" onClick={() => choose(t.id)}>
          <span className={"theme-preview " + t.id} aria-hidden="true">
            <i />
            <span>
              <b />
            </span>
          </span>
          <strong>{t.label}</strong>
          <small>{t.text}</small>
        </button>
      ))}
    </div>
  );
}


/** Compact choice for the profile menu: three swatches, applied at once. */
export function ThemeSwatches() {
  const [theme, setTheme] = useState<Theme>("licht");
  useEffect(() => {
    const t = document.getElementById("mavix-theme")?.dataset.themeFlag as Theme | undefined;
    if (t && THEMES.some((x) => x.id === t)) setTheme(t);
  }, []);
  function choose(t: Theme) {
    setTheme(t);
    const flag = document.getElementById("mavix-theme");
    if (flag) flag.dataset.themeFlag = t;
    // eslint-disable-next-line react-hooks/immutability -- writing the browser cookie is the point here
    document.cookie = `mavix-theme=${t}; path=/; max-age=31536000; samesite=lax`;
  }
  return (
    <div className="theme-swatches" role="radiogroup" aria-label="Thema">
      {THEMES.map((t) => (
        <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} title={t.text} onClick={() => choose(t.id)}>
          <span className={"theme-swatch " + t.id} aria-hidden="true" />
          {t.label}
        </button>
      ))}
    </div>
  );
}
