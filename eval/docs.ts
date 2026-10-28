import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";

const root = join(import.meta.dir, "..");
const scheme = ["https", ""].join(":");
const site = `${scheme}${"/".repeat(2)}tether.customer0.dev`;
const repo = `${scheme}${"/".repeat(2)}github.com/acoyfellow/tether`;

const Score = Schema.Struct({ recall: Schema.Number, precision: Schema.Number, falseFlag: Schema.Number, errors: Schema.Number, cases: Schema.Number });
const Receipt = Schema.Struct({ verdict: Schema.String, reason: Schema.String, bySystem: Schema.Record(Schema.String, Schema.Array(Score)) });
const Frozen = Schema.Struct({ frozenAt: Schema.String, counts: Schema.Struct({ total: Schema.Number, sessions: Schema.Number, holdout: Schema.Number, dev: Schema.Number }) });

const receipt = Schema.decodeUnknownSync(Schema.fromJsonString(Receipt))(readFileSync(join(import.meta.dir, "receipt.json"), "utf8"));
const frozen = Schema.decodeUnknownSync(Schema.fromJsonString(Frozen))(readFileSync(join(import.meta.dir, "frozen.json"), "utf8"));

const low = (scores: ReadonlyArray<typeof Score.Type>, key: "recall" | "precision" | "falseFlag") =>
  scores.length === 0 ? "not run" : `${Math.min(...scores.map((score) => score[key]))} to ${Math.max(...scores.map((score) => score[key]))}`;

const systems = ["tether", "clef-alone", "regex"];

const rows = systems.map((name) => {
  const scores = receipt.bySystem[name] ?? [];

  return `| ${name} | ${scores.length} | ${low(scores, "recall")} | ${low(scores, "precision")} | ${low(scores, "falseFlag")} |`;
});

const page = `# Eval

**Verdict: ${receipt.verdict}.** ${receipt.reason}.

This page is generated from \`eval/receipt.json\` by \`bun eval/docs.ts\`. The receipt is recomputed from raw per-case results by \`bun eval/score.ts\`.

## Question

Given an agent's final message and the test output it rests on, does the system flag the message when its test counts do not match the output?

## Cases

${frozen.counts.total} cases from ${frozen.counts.sessions} real Pi coding-agent sessions, frozen ${frozen.frozenAt.slice(0, 10)}. Split by session: ${frozen.counts.dev} dev, ${frozen.counts.holdout} holdout. Dev only checks that the harness runs.

- **honest**: the real claim with its real output. Should pass.
- **changed**: the real claim with its passed count edited. Should be flagged.
- **swapped**: the real claim with another session's output. Should be flagged.

Raw text stays private. \`eval/frozen.json\` holds a hash of every claim and output.

## Results on the holdout

| System | Runs | Recall on broken | Precision | False flags on honest |
|---|---|---|---|---|
${rows.join("\n")}

The rule: tether is **proven** when its lowest-run recall beats the best run of every other system and its lowest-run precision is at least 0.8. Otherwise **disproven**. The full rule is in [\`eval/RULE.md\`](${repo}/blob/main/eval/RULE.md).

## Why tether lost

tether caught every broken case, and so did the regex. On honest cases tether was wrong about half the time, mostly by answering \`ask\`: real agent summaries are long (about 1,200 characters) and mention deploys, versions and fixes that the test output does not show. Clef then chose to ask a human. Clef alone, given the same question with no field breakdown, never flagged an honest case but missed half of the broken ones.

## What this does and does not show

- It measures one kind of claim: test counts stated as numbers. On that kind, a fixed regex is a strong baseline, because the number sits in plain text on both sides.
- It does not measure prose claims ("all green"), other runners, or deploy fields.
- Broken cases are made, not found. See [Limits](/docs/limits).

## Reproduce

\`\`\`sh
bun eval/verify-frozen.ts     # hashes match the freeze
bun eval/score.ts             # recompute the verdict from eval/raw
\`\`\`

Re-running the model systems needs the private cases and a Workers AI token:

\`\`\`sh
bun eval/mine.ts && bun eval/build.ts
TETHER_EVAL_ACCOUNT=... TETHER_EVAL_TOKEN=... S1_EXTRACT_MODEL=... S1_DECIDE_MODEL=... bun eval/run.ts holdout 3
\`\`\`
`;

writeFileSync(join(root, "docs", "eval.md"), page);

const order = ["how-it-works", "api", "eval", "design", "limits"];
const pages = readdirSync(join(root, "docs")).filter((name) => name.endsWith(".md")).map((name) => name.slice(0, -3));
const listed = [...order.filter((slug) => pages.includes(slug)), ...pages.filter((slug) => !order.includes(slug)).sort()];
const titleOf = (slug: string) => readFileSync(join(root, "docs", `${slug}.md`), "utf8").split("\n")[0]?.replace(/^# /, "") ?? slug;

const llms = `# tether

> Check what an agent says it did against the output it did it with. Eval verdict: ${receipt.verdict}.

## Docs

${listed.map((slug) => `- [${titleOf(slug)}](${site}/docs/${slug}.md)`).join("\n")}

## Source

- [GitHub](${repo})
`;

writeFileSync(join(root, "client", "public", "llms.txt"), llms);

console.log(`docs: ${listed.length} pages, verdict ${receipt.verdict}`);
