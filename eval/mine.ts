import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { Match, Option, Schema } from "effect";

const PartSchema = Schema.Struct({ type: Schema.String, text: Schema.optional(Schema.String) });

const EntrySchema = Schema.Struct({
  type: Schema.String,
  message: Schema.optional(
    Schema.Struct({ role: Schema.String, content: Schema.optional(Schema.Union([Schema.String, Schema.Array(Schema.Union([PartSchema, Schema.Unknown]))])) }),
  ),
});

type Entry = typeof EntrySchema.Type;

const decodeEntry = Schema.decodeUnknownOption(Schema.fromJsonString(EntrySchema));

const decodePart = Schema.decodeUnknownOption(PartSchema);

export type Counts = { passed: number; failed: number };

export type MinedPair = {
  id: string;
  session: string;
  runner: "vitest" | "bun";
  evidence: string;
  claim: string;
  truth: Counts;
};

const sessionsRoot = join(homedir(), ".pi", "agent", "sessions");
const outDir = join(import.meta.dir, "..", ".real");

const Content = Schema.Union([Schema.String, Schema.Array(Schema.Unknown)]);

type Content = typeof Content.Type;

const partText = (part: Option.Option<typeof PartSchema.Type>): string =>
  Option.match(part, { onNone: () => "", onSome: (value) => (value.type === "text" ? (value.text ?? "") : "") });

const textOf = (content: Content | undefined): string =>
  Match.value(content).pipe(
    Match.when(Match.undefined, () => ""),
    Match.when(Match.string, (text) => text),
    Match.orElse((parts) => parts.map((raw) => partText(decodePart(raw))).filter((text) => text.length > 0).join("\n")),
  );

const stripAnsi = (value: string) => value.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");

export const parseRunner = (raw: string): { runner: MinedPair["runner"]; counts: Counts } | null => {
  const output = stripAnsi(raw);
  const vitest = output.match(/^\s*Tests\s+(?:(\d+) failed \| )?(\d+) passed/m);

  if (vitest) return { runner: "vitest", counts: { passed: Number(vitest[2]), failed: Number(vitest[1] ?? 0) } };
  const bunPass = output.match(/^\s*(\d+) pass\s*$/m);
  const bunFail = output.match(/^\s*(\d+) fail\s*$/m);

  if (bunPass && bunFail) return { runner: "bun", counts: { passed: Number(bunPass[1]), failed: Number(bunFail[1]) } };

  return null;
};

const mentionsTestCount = (claim: string) => /\b\d+\s*(?:\/\s*\d+\s*)?(?:tests?|pass(?:ed|ing)?|fail(?:ed|ing|ures?)?)\b/i.test(claim);

const sessionFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);

    if (statSync(path).isDirectory()) return sessionFiles(path);

    return name.endsWith(".jsonl") ? [path] : [];
  });

const maxEvidence = 6000;

const pairsIn = (path: string): MinedPair[] => {
  const session = createHash("sha256").update(path).digest("hex").slice(0, 12);
  const lines = readFileSync(path, "utf8").split("\n");
  const pairs: MinedPair[] = [];
  let pending: { runner: MinedPair["runner"]; counts: Counts; evidence: string } | null = null;

  for (const line of lines) {
    if (!line.startsWith("{")) continue;
    const decoded = decodeEntry(line);

    if (Option.isNone(decoded)) continue;

    const entry: Entry = decoded.value;
    const message = entry.message;

    if (entry.type !== "message" || !message) continue;
    const body = textOf(message.content);

    if (message.role === "toolResult") {
      const parsed = parseRunner(body);

      if (parsed) pending = { ...parsed, evidence: stripAnsi(body).slice(-maxEvidence) };
      continue;
    }

    if (message.role === "user") {
      pending = null;
      continue;
    }

    if (message.role === "assistant" && pending && body.trim().length > 0) {
      if (mentionsTestCount(body)) {
        const id = createHash("sha256").update(session).update(body).digest("hex").slice(0, 12);
        pairs.push({ id, session, runner: pending.runner, evidence: pending.evidence, claim: body.slice(0, 2000), truth: pending.counts });
        pending = null;
      }
    }
  }

  return pairs;
};

if (import.meta.main) {
  const all = sessionFiles(sessionsRoot).flatMap(pairsIn);
  const unique = [...new Map(all.map((pair) => [pair.id, pair])).values()];
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "mined.json"), JSON.stringify(unique, null, 1));
  const sessions = new Set(unique.map((pair) => pair.session)).size;
  console.log(`mined ${unique.length} pairs from ${sessions} sessions (vitest ${unique.filter((p) => p.runner === "vitest").length}, bun ${unique.filter((p) => p.runner === "bun").length})`);
}
