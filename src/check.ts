import { Effect } from "effect";
import { S1, probabilityYes, readField, type DecisionAnswer, type S1Error } from "./s1/index.ts";
import { ANCHORS, ANCHOR_THRESHOLD, CLAIMS, FIX_ESTIMATE, claimedFields, evidenceFields } from "./claims.ts";
import { type Line, type Tally, summarize, tally, tetherLine } from "./tether.ts";

export type Verdict = {
  readonly supported: number;
  readonly action: string;
  readonly actionProbabilities: Readonly<Record<string, number>>;
};

export type FixRange = { readonly median: number; readonly low: number; readonly high: number } | null;

export type CheckResult = {
  readonly lines: ReadonlyArray<Line>;
  readonly tally: Tally;
  readonly verdict: Verdict;
  readonly fixMinutes: FixRange;
  readonly inputTokens: number;
};

export type CheckRequest = { readonly claim: string; readonly evidence: string };

export const GATE_ACTIONS = {
  pass: "Accept the result",
  retry: "Send the work back to the agent to fix",
  ask: "Ask the owner to look",
} as const;

const choiceOf = (answer: DecisionAnswer | undefined): Pick<Verdict, "action" | "actionProbabilities"> =>
  answer?.type === "choice"
    ? { action: answer.choice, actionProbabilities: answer.probabilities }
    : { action: "ask", actionProbabilities: {} };

const fixRange = (lines: ReadonlyArray<Line>, reading: ReturnType<typeof readField> | null): FixRange =>
  lines.some((line) => line.status === "broken" || line.status === "unbacked") && reading?.kind === "range"
    ? { median: reading.median, low: reading.low, high: reading.high }
    : null;

export const check = ({ claim, evidence }: CheckRequest): Effect.Effect<CheckResult, S1Error, S1> =>
  Effect.gen(function* () {
    const s1 = yield* S1;

    const [claimed, found, ran] = yield* Effect.all(
      [
        s1.extract({ state: claim, fields: claimedFields(CLAIMS) }),
        s1.extract({ state: evidence, fields: { ...evidenceFields(CLAIMS), fix_minutes: FIX_ESTIMATE } }),
        s1.decide({ state: evidence, questions: ANCHORS }),
      ],
      { concurrency: 3 },
    );

    const happened = (id: keyof typeof ANCHORS) => {
      const answer = ran.answers[id];

      return answer !== undefined && probabilityYes(answer) >= ANCHOR_THRESHOLD;
    };

    const lines = CLAIMS.flatMap((spec) => {
      const a = claimed.answers[spec.id];
      const b = found.answers[spec.id];
      const anchored = spec.anchor === null || happened(spec.anchor);

      return a && b ? [tetherLine(spec, readField(a), readField(b), anchored)] : [];
    });

    const decided = yield* s1.decide({
      state: `Agent message:\n${claim}\n\nWhat the evidence shows, field by field:\n${summarize(lines)}`,
      questions: {
        supported: { type: "noul", instructions: "Does the evidence support every claim the agent made?" },
        action: { type: "choice", instructions: "What should a gate do with this result?", criteria: GATE_ACTIONS },
      },
    });

    const supportedAnswer = decided.answers["supported"];
    const fixAnswer = found.answers["fix_minutes"];

    return {
      lines,
      tally: tally(lines),
      verdict: {
        supported: supportedAnswer ? probabilityYes(supportedAnswer) : 0,
        ...choiceOf(decided.answers["action"]),
      },
      fixMinutes: fixRange(lines, fixAnswer ? readField(fixAnswer) : null),
      inputTokens: claimed.usage.input_tokens + found.usage.input_tokens + ran.usage.input_tokens + decided.usage.input_tokens,
    };
  });
