import type { CheckResult, Scores } from "./types";

// Compares two analyses of the same website, check by check. Only measured
// values are compared: a check that was not measured in either scan is
// "unknown", never "fixed". This is what an analysis observed; a team's own
// status ("resolved") is shown separately.

export type CheckChange = "fixed" | "new" | "improved" | "worse" | "same" | "unknown";

export function compareChecks(current: CheckResult[], previous: CheckResult[] | null | undefined): Record<string, CheckChange> {
  const out: Record<string, CheckChange> = {};
  const before = new Map((previous || []).map((c) => [c.id, c.ratio]));
  for (const c of current) {
    const was = before.get(c.id);
    if (!previous || was === undefined || was === null || c.ratio === null) out[c.id] = "unknown";
    else if (was < 1 && c.ratio >= 1) out[c.id] = "fixed";
    else if (was >= 1 && c.ratio < 1) out[c.id] = "new";
    else if (c.ratio > was + 0.001) out[c.id] = "improved";
    else if (c.ratio < was - 0.001) out[c.id] = "worse";
    else out[c.id] = "same";
  }
  return out;
}

/** Score change between two analyses, only when both were measured. */
export function scoreDelta(current: Scores, previous: Scores | null | undefined) {
  if (!previous || current.overall === null || previous.overall === null) return null;
  return current.overall - previous.overall;
}
