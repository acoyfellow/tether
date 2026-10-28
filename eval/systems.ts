import { Effect, Schema } from "effect";
import { S1, probabilityYes, s1Layer, type AiRunner, type JsonValue } from "../src/s1/index.ts";
import { check } from "../src/check.ts";

export type SystemName = "tether" | "clef-alone" | "regex";

export type Judgement = { flagged: boolean; detail: string };

export type Pair = { claim: string; evidence: string };

const claimCount = /(?<![\d.])(\d+)\s*(?:\/\s*\d+\s*)?(?:tests?\b|pass(?:ed|ing|es)?\b)/i;
const runnerCounts = [/^\s*Tests\s+(?:\d+ failed \| )?(\d+) passed/m, /^\s*(\d+) pass\s*$/m, /(\d+) passed/];

const firstNumber = (text: string, patterns: ReadonlyArray<RegExp>): number | null => {
  for (const pattern of patterns) {
    const found = text.match(pattern)?.[1];

    if (found !== undefined) return Number(found);
  }

  return null;
};

export const regexJudge = ({ claim, evidence }: Pair): Judgement => {
  const claimed = firstNumber(claim, [claimCount]);
  const found = firstNumber(evidence, runnerCounts);

  if (claimed === null || found === null) return { flagged: true, detail: `missing claimed=${claimed} found=${found}` };

  return { flagged: claimed !== found, detail: `claimed=${claimed} found=${found}` };
};

export type Models = { extract: string; decide: string };

const tetherJudge = (ai: AiRunner, models: Models, pair: Pair) =>
  check({ claim: pair.claim.slice(0, 12_000), evidence: pair.evidence.slice(0, 12_000) }).pipe(
    Effect.map((result): Judgement => ({
      flagged: result.verdict.action !== "pass",
      detail: `action=${result.verdict.action} broken=${result.tally.broken} held=${result.tally.held}`,
    })),
    Effect.provide(s1Layer(ai, models)),
  );

const clefAloneJudge = (ai: AiRunner, models: Models, pair: Pair) =>
  Effect.gen(function* () {
    const s1 = yield* S1;

    const decided = yield* s1.decide({
      state: `Agent message:\n${pair.claim.slice(0, 6000)}\n\nTest runner output:\n${pair.evidence.slice(0, 6000)}`,
      questions: { supported: { type: "noul", instructions: "Does the evidence support every claim the agent made?" } },
    });

    const answer = decided.answers["supported"];
    const p = answer ? probabilityYes(answer) : 0;

    return { flagged: p < 0.5, detail: `p=${p.toFixed(3)}` } satisfies Judgement;
  }).pipe(Effect.provide(s1Layer(ai, models)));

export const judge = (system: SystemName, ai: AiRunner, models: Models, pair: Pair): Promise<Judgement> => {
  if (system === "regex") return Promise.resolve(regexJudge(pair));

  const program = system === "tether" ? tetherJudge(ai, models, pair) : clefAloneJudge(ai, models, pair);

  return Effect.runPromise(program);
};

const JsonSchema: Schema.Codec<JsonValue> = Schema.Union([
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null,
  Schema.Array(Schema.suspend(() => JsonSchema)),
  Schema.Record(Schema.String, Schema.suspend(() => JsonSchema)),
]);

const RestReply = Schema.Struct({ success: Schema.Boolean, result: Schema.optional(JsonSchema) });

const decodeReply = Schema.decodeUnknownSync(RestReply);

export const restRunner = (accountId: string, token: string): AiRunner => ({
  async run(model: string, input: JsonValue): Promise<JsonValue> {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(input),
    });

    const text = await response.text();

    if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 300)}`);

    const reply = decodeReply(JSON.parse(text));

    if (!reply.success || reply.result === undefined) throw new Error(`model call failed: ${text.slice(0, 300)}`);

    return reply.result;
  },
});
