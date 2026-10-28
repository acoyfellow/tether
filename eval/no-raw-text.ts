import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";

const root = join(import.meta.dir, "..");
const casesPath = join(root, ".real", "cases.json");
const window = 60;

const CasesSchema = Schema.Array(Schema.Struct({ claim: Schema.String, evidence: Schema.String }));
const decodeCases = Schema.decodeUnknownSync(Schema.fromJsonString(CasesSchema));

if (!existsSync(casesPath)) {
  console.log("no private cases on this machine; skipped raw-text scan");
  process.exit(0);
}

const probes = new Set<string>();

for (const entry of decodeCases(readFileSync(casesPath, "utf8"))) {
  for (const text of [entry.claim, entry.evidence]) {
    const flat = text.replace(/\s+/g, " ").trim();

    for (let start = 0; start + window <= flat.length; start += window * 4) probes.add(flat.slice(start, start + window));
  }
}

const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter((path) => path.length > 0 && !path.startsWith("tools/") && !path.endsWith(".png") && path !== "package-lock.json");

const leaks = tracked.flatMap((path) => {
  const flat = readFileSync(join(root, path), "utf8").replace(/\s+/g, " ");

  return [...probes].some((probe) => flat.includes(probe)) ? [path] : [];
});

for (const path of leaks) console.error(`raw session text in ${path}`);

console.log(`raw-text scan: ${probes.size} probes, ${tracked.length} files, ${leaks.length} leaks`);

process.exit(leaks.length === 0 ? 0 : 1);
