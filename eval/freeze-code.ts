import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const files = ["systems.ts", "run.ts", "score.ts"];
const path = join(import.meta.dir, "frozen.json");
const frozen: Record<string, string> = JSON.parse(readFileSync(path, "utf8"));
const code = Object.fromEntries(files.map((name) => [name, createHash("sha256").update(readFileSync(join(import.meta.dir, name))).digest("hex")]));
const src = createHash("sha256").update(readFileSync(join(import.meta.dir, "..", "src", "check.ts"))).update(readFileSync(join(import.meta.dir, "..", "src", "tether.ts"))).update(readFileSync(join(import.meta.dir, "..", "src", "claims.ts"))).digest("hex");

writeFileSync(path, `${JSON.stringify({ ...frozen, code, pipeline: src, codeFrozenAt: new Date().toISOString() }, null, 1)}\n`);

console.log(code, src);
