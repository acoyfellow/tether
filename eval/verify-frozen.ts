import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";

const FrozenSchema = Schema.Struct({
  rule: Schema.String,
  build: Schema.String,
  mine: Schema.String,
  code: Schema.Record(Schema.String, Schema.String),
  pipeline: Schema.String,
  cases: Schema.String,
});

const decode = Schema.decodeUnknownSync(Schema.fromJsonString(FrozenSchema));
const here = import.meta.dir;
const frozen = decode(readFileSync(join(here, "frozen.json"), "utf8"));

const sha = (...paths: string[]) => {
  const hash = createHash("sha256");

  for (const path of paths) hash.update(readFileSync(path));

  return hash.digest("hex");
};

const checks: Array<[string, string, string]> = [
  ["RULE.md", frozen.rule, sha(join(here, "RULE.md"))],
  ["build.ts", frozen.build, sha(join(here, "build.ts"))],
  ["mine.ts", frozen.mine, sha(join(here, "mine.ts"))],
  ["pipeline", frozen.pipeline, sha(...["check.ts", "tether.ts", "claims.ts"].map((name) => join(here, "..", "src", name)))],
  ...Object.entries(frozen.code).map(([name, hash]): [string, string, string] => [name, hash, sha(join(here, name))]),
];

const cases = join(here, "..", ".real", "cases.json");

if (existsSync(cases)) checks.push(["cases", frozen.cases, sha(cases)]);

const bad = checks.filter(([, want, got]) => want !== got);

for (const [name] of bad) console.error(`changed since freeze: ${name}`);

console.log(`frozen: ${checks.length - bad.length}/${checks.length} match${existsSync(cases) ? "" : " (private cases absent; hashes only)"}`);

process.exit(bad.length === 0 ? 0 : 1);
