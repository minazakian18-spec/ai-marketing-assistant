// robots.txt parsing and matching (RFC 9309): groups per user-agent, the most
// specific group wins (our token "mavixbot", else "*"), longest matching rule
// wins, Allow wins a tie, "*" wildcards and "$" anchors are supported.

export type RobotsRule = { allow: boolean; path: string };
export type Robots = {
  groups: { agents: string[]; rules: RobotsRule[]; crawlDelay?: number }[];
  sitemaps: string[];
};

export const ROBOTS_TOKEN = "mavixbot";

export function parseRobots(text: string): Robots {
  const groups: Robots["groups"] = [];
  const sitemaps: string[] = [];
  let current: Robots["groups"][number] | null = null;
  let lastWasAgent = false;
  for (const raw of text.slice(0, 500_000).split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const at = line.indexOf(":");
    if (at < 1) continue;
    const key = line.slice(0, at).trim().toLowerCase();
    const value = line.slice(at + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (key === "sitemap") {
      if (/^https?:\/\//i.test(value)) sitemaps.push(value);
      continue;
    }
    if (!current) continue;
    if (key === "allow" || key === "disallow") {
      // An empty Disallow allows everything; it adds no rule.
      if (value) current.rules.push({ allow: key === "allow", path: value });
    } else if (key === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }
  return { groups, sitemaps };
}

function groupFor(robots: Robots, token = ROBOTS_TOKEN) {
  return (
    robots.groups.find((g) => g.agents.some((a) => a === token || (a !== "*" && token.startsWith(a)))) ||
    robots.groups.find((g) => g.agents.includes("*")) ||
    null
  );
}

function matches(pattern: string, path: string) {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp("^" + body + (anchored ? "$" : "")).test(path);
}

/** Is this path (with query) allowed for our crawler? */
export function robotsAllowed(robots: Robots | null, pathWithQuery: string, token = ROBOTS_TOKEN) {
  if (!robots) return true;
  const group = groupFor(robots, token);
  if (!group) return true;
  let best: RobotsRule | null = null;
  for (const rule of group.rules) {
    if (!matches(rule.path, pathWithQuery)) continue;
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow)) best = rule;
  }
  return !best || best.allow;
}

/** Crawl-delay in ms for our crawler, capped so a scan stays bounded. */
export function crawlDelayMs(robots: Robots | null, token = ROBOTS_TOKEN) {
  const d = robots ? groupFor(robots, token)?.crawlDelay : undefined;
  return d === undefined ? 0 : Math.min(d, 5) * 1000;
}
