import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Config, Effect, Schema } from "effect";
import { judge, restRunner, type SystemName } from "./systems.ts";

const root = join(import.meta.dir, "..");

const CaseSchema = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    split: Schema.Literals(["dev", "holdout"]),
    kind: Schema.Literals(["honest", "changed", "swapped"]),
    label: Schema.Literals(["held", "broken"]),
    claim: Schema.String,
    evidence: Schema.String,
  }),
);

const FrozenSchema = Schema.Struct({ cases: Schema.String });

const decodeCases = Schema.decodeUnknownSync(Schema.fromJsonString(CaseSchema));
const decodeFrozen = Schema.decodeUnknownSync(Schema.fromJsonString(FrozenSchema));

const casesText = readFileSync(join(root, ".real", "cases.json"), "utf8");
const frozen = decodeFrozen(readFileSync(join(import.meta.dir, "frozen.json"), "utf8"));
const actual = createHash("sha256").update(casesText).digest("hex");

if (actual !== frozen.cases) throw new Error(`cases hash ${actual} does not match frozen ${frozen.cases}`);

const [splitArg = "holdout", runsArg = "3", ...systemArgs] = process.argv.slice(2);
const split = splitArg === "dev" ? "dev" : "holdout";
const runs = Number(runsArg);
const systems: SystemName[] = systemArgs.length > 0 ? systemArgs.filter((name): name is SystemName => ["tether", "clef-alone", "regex"].includes(name)) : ["regex", "clef-alone", "tether"];

const optional = (name: string) => Config.String(name).pipe(Config.withDefault(""));

const settings = await Effect.runPromise(
  Effect.all({
    accountId: optional("TETHER_EVAL_ACCOUNT"),
    token: optional("TETHER_EVAL_TOKEN"),
    extract: optional("S1_EXTRACT_MODEL"),
    decide: optional("S1_DECIDE_MODEL"),
  }),
);

const { accountId, token } = settings;
const models = { extract: settings.extract, decide: settings.decide };
const ai = restRunner(accountId, token);

const cases = decodeCases(casesText).filter((entry) => entry.split === split);
const outDir = join(import.meta.dir, "raw");

mkdirSync(outDir, { recursive: true });

const concurrency = 6;

const mapLimited = async <T, R>(items: ReadonlyArray<T>, limit: number, task: (item: T) => Promise<R>): Promise<R[]> => {
  const results: R[] = [];
  let next = 0;

  const workers = Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      const item = items[index];

      if (item !== undefined) results[index] = await task(item);
    }
  });

  await Promise.all(workers);

  return results;
};

for (const system of systems) {
  const totalRuns = system === "regex" ? 1 : runs;

  for (let run = 1; run <= totalRuns; run += 1) {
    const path = join(outDir, `${split}-${system}-${run}.json`);

    if (existsSync(path)) {
      console.log(`skip ${path} (already scored once)`);
      continue;
    }

    if (system !== "regex" && (!accountId || !token || !models.extract || !models.decide)) {
      throw new Error("set TETHER_EVAL_ACCOUNT, TETHER_EVAL_TOKEN, S1_EXTRACT_MODEL, S1_DECIDE_MODEL");
    }

    const rows = await mapLimited(cases, system === "regex" ? 1 : concurrency, async (entry) => {
      const verdict = await judge(system, ai, models, entry).catch((error: Error) => ({ flagged: null, detail: `error: ${error.message.slice(0, 200)}` }));

      return { id: entry.id, kind: entry.kind, label: entry.label, flagged: verdict.flagged, detail: verdict.detail };
    });

    writeFileSync(path, `${JSON.stringify({ system, split, run, ranAt: new Date().toISOString(), rows }, null, 1)}\n`);
    console.log(`${system} run ${run}: ${rows.filter((row) => row.flagged === null).length} errors, written ${path}`);
  }
}
