import { readFileSync } from "node:fs";
import { type Compare, judge, sameValue } from "../../src/readback/check.ts";
import type { Case } from "./gen.ts";

const cases = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8")) as Case[];

function lastWrite(item: Case): Record<string, unknown> {
  return Object.assign({}, ...item.steps);
}

function brokenCount(compare: Compare, keys: Set<string>): number {
  return cases
    .filter((item) => item.fault !== "honest" && item.record.changes.some((change) => keys.has(change.key)))
    .filter((item) => judge(item.record, lastWrite(item), compare).verdict === "broken").length;
}

const keys = [...new Set(cases.flatMap((item) => item.record.changes.map((change) => change.key)))];
let ok = true;
for (const key of keys) {
  const scope = new Set([key]);
  const baseline = brokenCount(sameValue, scope);
  const mutant: Compare = (field, expected, observed) => field === key || sameValue(field, expected, observed);
  const mutated = brokenCount(mutant, scope);
  const killed = mutated < baseline;
  ok &&= killed;
  console.log(key, { baseline, mutated, killed });
}
console.log(ok ? "mutation: every field comparison matters" : "mutation: FAIL");
process.exit(ok ? 0 : 1);
