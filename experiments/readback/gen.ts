import { writeFileSync } from "node:fs";
import type { Target, WriteRecord } from "../../src/readback/check.ts";

const KV_NAMESPACE = "79cfce90b4ab46a3a72350e734d697b5";
const D1_DATABASE = "0280a10a-efc6-4eb7-8eee-94926f380bb8";
const SCRIPTS = Array.from({ length: 10 }, (_, index) => `gl-sb-${index + 1}`);
const FAULTS = ["never_applied", "wrong_value", "overwritten", "partial"] as const;

type Fault = (typeof FAULTS)[number] | "honest";
type Step = Record<string, unknown>;
export type Case = { id: string; kind: Target["kind"]; fault: Fault; record: WriteRecord; steps: Step[] };

let seed = 7;
function random(): number {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
function token(): string {
  return Math.floor(random() * 1e9).toString(36);
}

function targetFor(kind: Target["kind"], index: number): Target {
  if (kind === "kv") return { kind, namespace: KV_NAMESPACE, key: `rb-${index}` };
  if (kind === "d1") return { kind, database: D1_DATABASE, table: "gl_rb", id: `rb-${index}` };
  return { kind, script: SCRIPTS[index % SCRIPTS.length] as string };
}

function claimedValues(kind: Target["kind"]): Step {
  if (kind === "kv") return { value: `v-${token()}` };
  if (kind === "d1") return { a: `a-${token()}`, b: `b-${token()}` };
  return { tag0: `rb-0-${token()}`, tag1: `rb-1-${token()}` };
}

function changed(values: Step): Step {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, `${String(value)}-x`]));
}

function stepsFor(fault: Fault, kind: Target["kind"], values: Step, index: number): Step[] {
  if (fault === "honest") return [values];
  if (fault === "never_applied") return [];
  if (fault === "wrong_value") return [changed(values)];
  if (fault === "overwritten") return [values, changed(values)];
  if (kind === "kv") return [changed(values)];
  const keys = Object.keys(values);
  const dropped = keys[(index >> 2) % 2] as string;
  return [{ ...values, [dropped]: `${dropped}-old` }];
}

function faultAt(index: number): Fault {
  return index < 10 ? "honest" : (FAULTS[(index - 10) % FAULTS.length] as Fault);
}

const cases: Case[] = [];
for (const kind of ["kv", "d1", "worker_tags"] as const) {
  for (let index = 0; index < 20; index += 1) {
    const fault = faultAt(index);
    const values = claimedValues(kind);
    const target = targetFor(kind, index);
    cases.push({
      id: `${kind}-${index}`,
      kind,
      fault: kind === "kv" && fault === "partial" ? "wrong_value" : fault,
      record: {
        tool_name: "execute",
        account_id: "customer0",
        target,
        changes: Object.entries(values).map(([key, after]) => ({ key, before: null, after })),
        result: { success: true },
      },
      steps: stepsFor(fault, kind, values, index),
    });
  }
}

writeFileSync(new URL("./cases.json", import.meta.url), `${JSON.stringify(cases, null, 2)}\n`);
console.log(cases.length, "cases");
