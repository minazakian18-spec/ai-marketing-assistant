import "server-only";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { HttpError } from "../access";
import { aiStep } from "../openai";
import { stepsFor } from "../ai-usage";
import { Loader, toolsFor, toFunction, type AgentCtx } from "./tools";

// The Mavix Agent tool loop. Runs inside metered("agent"): every model call
// takes one step of the up-front budget reservation (MAX_STEPS.agent), and
// all tokens of all steps are recorded on that one ledger row.
//
// Limits per user turn:
//   model calls  stepsFor("agent")  (the last one may not call tools)
//   tool calls   MAX_TOOL_CALLS     (extra calls get an error result)
//   per tool     TOOL_TIMEOUT_MS, result capped at RESULT_CHARS
//   repeats      the same tool with the same arguments runs once

export const MAX_TOOL_CALLS = 6;
export const TOOL_TIMEOUT_MS = 10_000;
export const RESULT_CHARS = 6_000;

export type LoopResult = { text: string; tools: string[]; proposed: { id: string; summary: string }[] };

function withTimeout<T>(p: Promise<T>, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new HttpError(504, "Deze gegevens kwamen niet op tijd binnen.")), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

// Tool results go back as JSON data. Oversized results are cut at the item
// level (longest array first) so the model still receives valid JSON.
export function fitResult(value: unknown, max = RESULT_CHARS): string {
  let json = JSON.stringify(value);
  if (json.length <= max) return json;
  const copy = JSON.parse(json) as Record<string, unknown>;
  const arrays = (o: unknown): unknown[][] => {
    if (!o || typeof o !== "object") return [];
    const own = Array.isArray(o) ? [o as unknown[]] : [];
    return [...own, ...Object.values(o as object).flatMap(arrays)];
  };
  for (let i = 0; i < 100 && json.length > max; i++) {
    const longest = arrays(copy).sort((a, b) => b.length - a.length)[0];
    if (!longest?.length) break;
    // Drop the newest-last quarter (at least one item) per round.
    longest.splice(Math.max(0, Math.min(longest.length - 1, Math.floor(longest.length * 0.75))));
    copy.truncated = true;
    json = JSON.stringify(copy);
  }
  return json.length <= max ? json : JSON.stringify({ ok: false, error: "Het resultaat was te groot." });
}

export async function runAgentLoop(ctx: AgentCtx, instructions: string, first: ResponseInputItem[]): Promise<LoopResult> {
  const load = new Loader(ctx);
  const offered = await toolsFor(ctx, load);
  const defs = offered.map(toFunction);
  const input: ResponseInputItem[] = [...first];
  const seen = new Set<string>();
  const used: string[] = [];
  let toolCalls = 0;
  const steps = stepsFor("agent");

  for (let step = 0; step < steps; step++) {
    const final = step === steps - 1 || toolCalls >= MAX_TOOL_CALLS;
    const r = await aiStep(instructions, input, defs, final);
    if (!r.calls.length || final) {
      if (!r.text) throw new HttpError(502, "Mavi gaf geen antwoord terug. Probeer het opnieuw.");
      return { text: r.text, tools: used, proposed: load.proposed };
    }
    input.push(...r.carry);
    for (const call of r.calls) {
      const started = Date.now();
      let result: unknown;
      const tool = offered.find((t) => t.name === call.name);
      const key = call.name + ":" + call.arguments;
      if (!tool) result = { ok: false, error: "Deze tool bestaat niet of is voor deze werkruimte niet beschikbaar." };
      else if (++toolCalls > MAX_TOOL_CALLS) result = { ok: false, error: "Maximaal aantal opzoekingen bereikt. Beantwoord de vraag met wat je al hebt." };
      else if (seen.has(key)) result = { ok: false, error: "Deze gegevens zijn al opgehaald; gebruik het eerdere resultaat." };
      else {
        seen.add(key);
        let args: unknown;
        try {
          args = tool.args.parse(JSON.parse(call.arguments || "{}"));
        } catch {
          args = undefined;
        }
        if (args === undefined) result = { ok: false, error: "Ongeldige argumenten voor deze tool." };
        else
          try {
            result = { ok: true, data: await withTimeout(tool.run(ctx, args, load), TOOL_TIMEOUT_MS) };
            used.push(tool.name);
          } catch (e) {
            // Only user-safe messages reach the model; details stay in the log.
            result = { ok: false, error: e instanceof HttpError ? e.message : "Deze gegevens konden niet worden opgehaald." };
          }
      }
      console.info(JSON.stringify({ event: "agent_tool", tool: tool ? call.name : "unknown", ok: (result as { ok: boolean }).ok, ms: Date.now() - started }));
      input.push({ type: "function_call_output", call_id: call.call_id, output: fitResult(result) });
    }
  }
  throw new HttpError(502, "Mavi kon deze vraag niet afronden. Probeer het opnieuw.");
}
