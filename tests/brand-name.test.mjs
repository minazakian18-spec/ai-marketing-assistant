import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// The assistant is called "Mavix" in everything a user reads. Code
// identifiers (Mavi, MaviAvatar, MaviState, <Mavi …/>) may keep their names.
function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

test('no user-facing "Mavi" left: strings, JSX text and AI prompts say "Mavix"', () => {
  const found = [];
  for (const file of files("src")) {
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .forEach((line, i) => {
        const t = line.trim();
        if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*") || /^import\b/.test(t) || /^export \{/.test(t)) return;
        // Remove what is code: JSX tags, import/destructuring lists, values like "icon: Mavi,".
        const visible = line
          .replace(/<\/?Mavi\w*/g, "")
          .replace(/[{,]\s*Mavi\w*\s*(?=[,}])/g, "")
          .replace(/:\s*Mavi\s*(?=[,}]|$)/g, "")
          .replace(/\bMavi\w+/g, "")
          .replace(/function Mavi\b|\bMavi\(/g, "");
        if (/\bMavi\b(?!x)/.test(visible)) found.push(file + ":" + (i + 1) + "  " + t.slice(0, 120));
      });
  }
  assert.deepEqual(found, []);
});
