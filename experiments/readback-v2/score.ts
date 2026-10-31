import { readFileSync, readdirSync } from "node:fs";

type Setup = { reset_ok: boolean; write_ok: boolean | null; fault_ok: boolean | null };
type Row = { id: string; task: string; fault: string; setup: Setup; derivable: boolean; verdict: string; fields: { key: string; expected: string; held: boolean }[]; observed: unknown };

function status(row: Row): "valid" | "write_rejected" | "setup_invalid" {
  if (row.fault === "honest") return row.setup.write_ok ? "valid" : "write_rejected";
  if (!row.setup.reset_ok) return "setup_invalid";
  if (row.setup.write_ok === false || row.setup.fault_ok === false) return "setup_invalid";
  return "valid";
}

const root = new URL("./runs/", import.meta.url);
const report: Record<string, unknown> = {};
let pass = true;
const scored = readdirSync(root).filter((run) => /^r\d+$/.test(run)).sort();
for (const run of scored) {
  const rows = readdirSync(new URL(`${run}/`, root)).map((file) => JSON.parse(readFileSync(new URL(`${run}/${file}`, root), "utf8")) as Row);
  const valid = rows.filter((row) => status(row) === "valid");
  const derivable = valid.filter((row) => row.derivable);
  const faulty = derivable.filter((row) => row.fault !== "honest");
  const honest = derivable.filter((row) => row.fault === "honest");
  const recall = faulty.filter((row) => row.verdict === "broken").length / faulty.length;
  const falseAlarms = honest.filter((row) => row.verdict === "broken");
  const falseAlarm = falseAlarms.length / honest.length;
  const derivableRate = derivable.length / valid.length;
  const runPass = derivableRate >= 0.9 && recall >= 0.95 && falseAlarm <= 0.1;
  pass &&= runPass;
  report[run] = {
    n: rows.length,
    valid: valid.length,
    write_rejected: rows.filter((row) => status(row) === "write_rejected").map((row) => row.id),
    setup_invalid: rows.filter((row) => status(row) === "setup_invalid").map((row) => row.id),
    derivable: derivableRate,
    faulty: faulty.length,
    recall,
    missed: faulty.filter((row) => row.verdict !== "broken").map((row) => row.id),
    honest: honest.length,
    false_alarm: falseAlarm,
    false_alarms: falseAlarms.map((row) => ({ id: row.id, fields: row.fields, observed: JSON.stringify(row.observed).slice(0, 200) })),
    pass: runPass,
  };
}
console.log(JSON.stringify({ runs: report, pass: pass && scored.length >= 3 }, null, 2));
