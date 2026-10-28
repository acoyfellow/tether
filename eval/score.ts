import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";

const RawSchema = Schema.Struct({
  system: Schema.String,
  split: Schema.String,
  run: Schema.Number,
  rows: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      kind: Schema.String,
      label: Schema.Literals(["held", "broken"]),
      flagged: Schema.NullOr(Schema.Boolean),
      detail: Schema.String,
    }),
  ),
});

type Raw = typeof RawSchema.Type;

const decodeRaw = Schema.decodeUnknownSync(Schema.fromJsonString(RawSchema));

export type RunScore = { run: number; recall: number; precision: number; falseFlag: number; errors: number; cases: number };

const ratio = (top: number, bottom: number) => (bottom === 0 ? 0 : Number((top / bottom).toFixed(4)));

export const scoreRun = (raw: Raw): RunScore => {
  const broken = raw.rows.filter((row) => row.label === "broken");
  const held = raw.rows.filter((row) => row.label === "held");
  const truePositives = broken.filter((row) => row.flagged === true).length;
  const flagged = raw.rows.filter((row) => row.flagged === true).length;

  return {
    run: raw.run,
    recall: ratio(truePositives, broken.length),
    precision: ratio(truePositives, flagged),
    falseFlag: ratio(held.filter((row) => row.flagged === true).length, held.length),
    errors: raw.rows.filter((row) => row.flagged === null).length,
    cases: raw.rows.length,
  };
};

export type Verdict = "proven" | "disproven" | "incomplete";

export type VerdictResult = { verdict: Verdict; reason: string };

export const verdictOf = (bySystem: Readonly<Record<string, ReadonlyArray<RunScore>>>): VerdictResult => {
  const tether = bySystem["tether"] ?? [];
  const clef = bySystem["clef-alone"] ?? [];
  const regex = bySystem["regex"] ?? [];

  if (tether.length < 3 || clef.length < 3 || regex.length < 1) return { verdict: "incomplete", reason: "need 3 tether runs, 3 clef-alone runs and 1 regex run" };

  const tetherLowRecall = Math.min(...tether.map((score) => score.recall));
  const tetherLowPrecision = Math.min(...tether.map((score) => score.precision));
  const rivalRecall = Math.max(...clef.map((score) => score.recall), ...regex.map((score) => score.recall));
  const proven = tetherLowRecall > rivalRecall && tetherLowPrecision >= 0.8;

  return {
    verdict: proven ? "proven" : "disproven",
    reason: `tether lowest recall ${tetherLowRecall} vs best rival ${rivalRecall}; tether lowest precision ${tetherLowPrecision} (needs >= 0.8)`,
  };
};

if (import.meta.main) {
  const rawDir = join(import.meta.dir, "raw");
  const files = readdirSync(rawDir).filter((name) => name.startsWith("holdout-") && name.endsWith(".json"));
  const bySystem: Record<string, RunScore[]> = {};

  for (const name of files.sort()) {
    const raw = decodeRaw(readFileSync(join(rawDir, name), "utf8"));
    (bySystem[raw.system] ??= []).push(scoreRun(raw));
  }

  const result = { ...verdictOf(bySystem), bySystem, scoredAt: new Date().toISOString() };
  writeFileSync(join(import.meta.dir, "receipt.json"), `${JSON.stringify(result, null, 1)}\n`);
  console.log(`${result.verdict}: ${result.reason}`);

  for (const [system, scores] of Object.entries(bySystem)) {
    console.log(`  ${system}: ${scores.map((score) => `r=${score.recall} p=${score.precision} ff=${score.falseFlag} err=${score.errors}`).join(" | ")}`);
  }
}
