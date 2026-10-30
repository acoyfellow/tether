import { readFileSync, readdirSync } from "node:fs";

type Row = { id: string; kind: string; fault: string; api_ok: string; readback: { verdict: string }; ms: number; calls: number };

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function rates(rows: Row[], pick: (row: Row) => string) {
  const faulty = rows.filter((row) => row.fault !== "honest");
  const honest = rows.filter((row) => row.fault === "honest");
  return {
    recall: faulty.filter((row) => pick(row) === "broken").length / faulty.length,
    false_alarm: honest.filter((row) => pick(row) === "broken").length / honest.length,
  };
}

const root = new URL("./runs/", import.meta.url);
const report: Record<string, unknown> = {};
let pass = true;
for (const run of readdirSync(root).sort()) {
  const rows = readdirSync(new URL(`${run}/`, root))
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(readFileSync(new URL(`${run}/${file}`, root), "utf8")) as Row);
  const kinds = [...new Set(rows.map((row) => row.kind))];
  const perKind = Object.fromEntries(kinds.map((kind) => [kind, rates(rows.filter((row) => row.kind === kind), (row) => row.readback.verdict)]));
  const readback = rates(rows, (row) => row.readback.verdict);
  const api_ok = rates(rows, (row) => row.api_ok);
  const ms = rows.map((row) => row.ms);
  const missed = rows.filter((row) => row.fault !== "honest" && row.readback.verdict !== "broken").map((row) => row.id);
  const runPass =
    rows.length === 60 &&
    Object.values(perKind).every((rate) => rate.recall === 1) &&
    readback.false_alarm <= 0.05 &&
    median(ms) < 1000 &&
    api_ok.recall < 0.5;
  pass &&= runPass;
  report[run] = {
    n: rows.length,
    readback,
    per_kind: perKind,
    api_ok,
    ms_median: Math.round(median(ms)),
    ms_max: Math.round(Math.max(...ms)),
    calls_per_check: rows.reduce((sum, row) => sum + row.calls, 0) / rows.length,
    missed,
    pass: runPass,
  };
}
const runs = Object.keys(report).length;
console.log(JSON.stringify({ runs: report, pass: pass && runs >= 3 }, null, 2));
