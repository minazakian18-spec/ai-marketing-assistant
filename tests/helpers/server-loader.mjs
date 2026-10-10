import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

// Transpile actual route/service modules in memory. Only framework request
// context, Supabase and network boundaries are mocked; no production files change.
export function serverLoader(mocks) {
  const root = path.resolve("src"),
    cache = new Map();
  const external = createRequire(import.meta.url);
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} };
    cache.set(filename, mod);
    const source = fs.readFileSync(filename, "utf8");
    const js = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    function require(specifier) {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      if (specifier === "server-only") return {};
      if (specifier.startsWith(".") || specifier.startsWith("@/")) {
        let resolved = specifier.startsWith("@/")
          ? path.join(root, specifier.slice(2))
          : path.resolve(path.dirname(filename), specifier);
        if (!path.extname(resolved)) resolved += ".ts";
        if (Object.hasOwn(mocks, resolved)) return mocks[resolved];
        return load(resolved);
      }
      return external(specifier);
    }
    new Function("require", "module", "exports", js)(require, mod, mod.exports);
    return mod.exports;
  }
  return load;
}

export function memoryDb(tables) {
  function from(table) {
    let operation = "read",
      values,
      options,
      returning = false,
      countMode = false,
      head = false;
    const predicates = [];
    const sorters = [];
    const q = {
      select(_columns, opts) {
        returning = true;
        countMode = !!opts?.count;
        head = !!opts?.head;
        return q;
      },
      eq(key, value) {
        predicates.push((row) => row[key] === value);
        return q;
      },
      match(values) {
        for (const [key, value] of Object.entries(values)) q.eq(key, value);
        return q;
      },
      in(key, values) {
        predicates.push((row) => values.includes(row[key]));
        return q;
      },
      neq(key, value) {
        predicates.push((row) => row[key] !== value);
        return q;
      },
      gt(key, value) {
        predicates.push((row) => row[key] > value);
        return q;
      },
      lt(key, value) {
        predicates.push((row) => row[key] < value);
        return q;
      },
      lte(key, value) {
        predicates.push((row) => row[key] <= value);
        return q;
      },
      is(key, value) {
        predicates.push((row) => row[key] === value);
        return q;
      },
      order(key, opts) {
        const dir = opts?.ascending === false ? -1 : 1;
        sorters.push((a, b) => (a[key] < b[key] ? -dir : a[key] > b[key] ? dir : 0));
        return q;
      },
      limit() {
        return q;
      },
      insert(value) {
        operation = "insert";
        values = value;
        return q;
      },
      upsert(value, opts) {
        operation = "upsert";
        values = value;
        options = opts;
        return q;
      },
      update(value) {
        operation = "update";
        values = value;
        return q;
      },
      delete() {
        operation = "delete";
        return q;
      },
      async maybeSingle() {
        const r = await execute();
        return { ...r, data: r.data?.[0] || null };
      },
      async single() {
        return q.maybeSingle();
      },
      then(resolve, reject) {
        return execute().then(resolve, reject);
      },
    };
    async function execute() {
      if (tables.failTable === table)
        return { data: null, error: { message: "simulated DB outage" } };
      const rows = (tables[table] ||= []);
      let selected = rows.filter((row) =>
        predicates.every((predicate) => predicate(row)),
      );
      if (operation === "insert" || operation === "upsert") {
        const existing =
          operation === "upsert" &&
          rows.find((row) =>
            options.onConflict
              .split(",")
              .every((key) => row[key] === values[key]),
          );
        if (existing) {
          if (!options.ignoreDuplicates) Object.assign(existing, values);
          selected = [existing];
        } else {
          const row = {
            id: "id-" + rows.length,
            connection_generation: "generation-0",
            metadata: {},
            ...values,
          };
          rows.push(row);
          selected = [row];
        }
      }
      if (operation === "update")
        selected.forEach((row) => Object.assign(row, values));
      if (operation === "delete")
        tables[table] = rows.filter((row) => !selected.includes(row));
      if (operation === "read" && sorters.length)
        selected = [...selected].sort((a, b) => {
          for (const s of sorters) {
            const r = s(a, b);
            if (r) return r;
          }
          return 0;
        });
      return {
        data:
          head ? null : operation === "read" || returning ? structuredClone(selected) : null,
        ...(countMode ? { count: selected.length } : {}),
        error: null,
      };
    }
    return q;
  }
  return { from, rpc: async () => ({ data: true, error: null }) };
}
