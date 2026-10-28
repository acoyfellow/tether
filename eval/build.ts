import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";
import type { MinedPair } from "./mine.ts";

const MinedSchema = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    session: Schema.String,
    runner: Schema.Literals(["vitest", "bun"]),
    evidence: Schema.String,
    claim: Schema.String,
    truth: Schema.Struct({ passed: Schema.Number, failed: Schema.Number }),
  }),
);

const decodeMined = Schema.decodeUnknownSync(Schema.fromJsonString(MinedSchema));

export type EvalCase = {
  id: string;
  session: string;
  split: "dev" | "holdout";
  kind: "honest" | "changed" | "swapped";
  label: "held" | "broken";
  claim: string;
  evidence: string;
  truthPassed: number;
};

const root = join(import.meta.dir, "..");
const perKind = 40;
const perSession = 2;
const kinds: ReadonlyArray<EvalCase["kind"]> = ["honest", "changed", "swapped"];

const seeded = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;

  return seed / 2147483648;
};

const standalone = (text: string, value: number) => new RegExp(`(?<![\\d.])${value}(?![\\d.])`).test(text);

const shuffle = <T>(items: ReadonlyArray<T>, random: () => number): T[] => {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const held = copy[index];
    const swap = copy[other];

    if (held !== undefined && swap !== undefined) {
      copy[index] = swap;
      copy[other] = held;
    }
  }

  return copy;
};

const splitOf = (session: string): EvalCase["split"] => (Number.parseInt(session.slice(0, 1), 16) % 2 === 0 ? "dev" : "holdout");

const changedCount = (count: number, random: () => number) => {
  const step = 1 + Math.floor(random() * 5);

  return count > step && random() < 0.5 ? count - step : count + step;
};

export const buildCases = (mined: ReadonlyArray<MinedPair>): EvalCase[] => {
  const random = seeded(17);
  const eligible = mined.filter((pair) => pair.truth.passed > 0 && standalone(pair.claim, pair.truth.passed));
  const used = new Map<string, number>();
  const picked: MinedPair[] = [];

  for (const pair of shuffle(eligible, random)) {
    const count = used.get(pair.session) ?? 0;

    if (count >= perSession) continue;
    used.set(pair.session, count + 1);
    picked.push(pair);

    if (picked.length === perKind * 3) break;
  }

  return picked.map((pair, index): EvalCase => {
    const base = { session: pair.session, split: splitOf(pair.session), truthPassed: pair.truth.passed };
    const kind = kinds[index % kinds.length] ?? "honest";

    if (kind === "honest") return { ...base, id: `${pair.id}-h`, kind, label: "held", claim: pair.claim, evidence: pair.evidence };

    if (kind === "changed") {
      const value = changedCount(pair.truth.passed, random);
      const claim = pair.claim.replace(new RegExp(`(?<![\\d.])${pair.truth.passed}(?![\\d.])`, "g"), String(value));

      return { ...base, id: `${pair.id}-c`, kind, label: "broken", claim, evidence: pair.evidence };
    }

    const donor = picked.find((other) => other.session !== pair.session && other.truth.passed !== pair.truth.passed);

    if (!donor) throw new Error(`no donor output for ${pair.id}`);

    return { ...base, id: `${pair.id}-s`, kind, label: "broken", claim: pair.claim, evidence: donor.evidence, truthPassed: donor.truth.passed };
  });
};

const sha = (value: string) => createHash("sha256").update(value).digest("hex");

if (import.meta.main) {
  const mined = decodeMined(readFileSync(join(root, ".real", "mined.json"), "utf8"));
  const cases = buildCases(mined);
  const body = JSON.stringify(cases);
  writeFileSync(join(root, ".real", "cases.json"), body);

  const summary = {
    frozenAt: new Date().toISOString(),
    rule: sha(readFileSync(join(import.meta.dir, "RULE.md"), "utf8")),
    build: sha(readFileSync(join(import.meta.dir, "build.ts"), "utf8")),
    mine: sha(readFileSync(join(import.meta.dir, "mine.ts"), "utf8")),
    cases: sha(body),
    caseIds: cases.map((entry) => ({ id: entry.id, split: entry.split, kind: entry.kind, label: entry.label, claim: sha(entry.claim), evidence: sha(entry.evidence) })),
    counts: {
      total: cases.length,
      sessions: new Set(cases.map((entry) => entry.session)).size,
      holdout: cases.filter((entry) => entry.split === "holdout").length,
      dev: cases.filter((entry) => entry.split === "dev").length,
    },
  };

  writeFileSync(join(import.meta.dir, "frozen.json"), `${JSON.stringify(summary, null, 1)}\n`);
  console.log(JSON.stringify(summary.counts));
}
