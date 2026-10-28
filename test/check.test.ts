import { Effect } from "effect";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { type AiRunner, s1Layer } from "../src/s1/index.ts";
import { check } from "../src/check.ts";
import { statusOf } from "../src/tether.ts";

const scalar = (value: number | null) => ({ type: "number", p_null: value === null ? 1 : 0, confidence: 1, value });

const text = (value: string | null, span: [number, number]) => ({ type: "text", p_null: value === null ? 1 : 0, confidence: 0.58, value, span });

const claimReply = {
  answers: {
    tests_passed: scalar(42),
    tests_failed: scalar(0),
    deploy_url: text("https://hark.coey.dev", [40, 61]),
    version: text("7f3a91c", [74, 81]),
    exit_code: scalar(null),
  },
  usage: { input_tokens: 100 },
};

const evidenceReply = {
  answers: {
    tests_passed: scalar(40),
    tests_failed: scalar(2),
    deploy_url: text("https://hark.coey.dev", [120, 141]),
    version: text("7f3a91c2-aa10", [160, 173]),
    exit_code: scalar(1),
    fix_minutes: { type: "estimate", value: 5, mean: 6, median: 5, p10: 2, p90: 10, p_below: 0, p_above: 0 },
  },
  usage: { input_tokens: 200 },
};

const decideReply = {
  answers: {
    supported: { type: "noul", noul: 0.02 },
    action: { type: "choice", choice: "retry", probabilities: { pass: 0.01, retry: 0.93, ask: 0.06 }, confidence: 0.8 },
  },
  usage: { input_tokens: 50 },
};

const ranReply = (tests: number, deploy: number) => ({
  answers: { test_run: { type: "noul", noul: tests }, deploy_run: { type: "noul", noul: deploy } },
  usage: { input_tokens: 25 },
});

const ModelInput = Schema.Struct({ state: Schema.String, questions: Schema.optional(Schema.Record(Schema.String, Schema.Json)) });

const readInput = Schema.decodeUnknownSync(ModelInput);

const isAnchorCall = (input: typeof ModelInput.Type) => input.questions?.["test_run"] !== undefined;

const fakeAi = (): AiRunner & { readonly calls: Array<{ model: string; state: string }> } => {
  const calls: Array<{ model: string; state: string }> = [];

  return {
    calls,
    run: async (model, input) => {
      const request = readInput(input);
      const { state } = request;
      calls.push({ model, state });

      if (model === "decide") return isAnchorCall(request) ? ranReply(0.99, 0.99) : decideReply;

      return state.startsWith("Done") ? claimReply : evidenceReply;
    },
  };
};

const request = { claim: "Done. 42 tests passed.", evidence: "40 pass\n2 fail" };

const run = (ai: AiRunner) =>
  Effect.runPromise(check(request).pipe(Effect.provide(s1Layer(ai, { extract: "extract", decide: "decide" }))));

describe("check", () => {
  it("draws a broken line for a claim the evidence contradicts", async () => {
    const result = await run(fakeAi());
    const passed = result.lines.find((line) => line.id === "tests_passed");
    expect(passed).toMatchObject({ status: "broken", claim: { value: "42" }, evidence: { value: "40" } });
  });

  it("holds a line when the evidence names the same thing", async () => {
    const result = await run(fakeAi());
    expect(result.lines.find((line) => line.id === "deploy_url")?.status).toBe("held");
    expect(result.lines.find((line) => line.id === "version")?.status).toBe("held");
  });

  it("keeps each side's span pointing into its own text", async () => {
    const result = await run(fakeAi());
    const url = result.lines.find((line) => line.id === "deploy_url");
    expect(url?.claim.span).toEqual([40, 61]);
    expect(url?.evidence.span).toEqual([120, 141]);
  });

  it("skips claims the agent never made", async () => {
    const result = await run(fakeAi());
    expect(result.lines.find((line) => line.id === "exit_code")?.status).toBe("unclaimed");
  });

  it("returns the gate verdict and a fix estimate when a line breaks", async () => {
    const result = await run(fakeAi());
    expect(result.verdict).toMatchObject({ action: "retry" });
    expect(result.verdict.supported).toBeLessThan(0.05);
    expect(result.fixMinutes).toEqual({ median: 5, low: 2, high: 10 });
    expect(result.tally).toEqual({ held: 2, broken: 2, unbacked: 0 });
    expect(result.inputTokens).toBe(375);
  });

  it("gives the decide model the field-by-field comparison", async () => {
    const ai = fakeAi();
    await run(ai);
    const decide = ai.calls.find((call) => call.model === "decide" && call.state.startsWith("Agent message"));
    expect(decide?.state).toContain("Tests passed: claimed 42, evidence shows 40 (broken)");
  });
});

describe("anchors", () => {
  it("does not let an inferred zero back a test claim when no test ran", async () => {
    const noTests = {
      ...evidenceReply,
      answers: { ...evidenceReply.answers, tests_passed: scalar(null), tests_failed: scalar(0) },
    };

    const ai: AiRunner = {
      run: async (model, input) => {
        const request = readInput(input);

        if (model === "decide") return isAnchorCall(request) ? ranReply(0.006, 0.006) : decideReply;

        return request.state.startsWith("Done") ? claimReply : noTests;
      },
    };

    const result = await run(ai);
    const failed = result.lines.find((line) => line.id === "tests_failed");
    expect(failed).toMatchObject({ status: "unbacked", evidence: { value: null } });
  });
});

describe("statusOf", () => {
  it("marks a claim with nothing behind it as unbacked", () => {
    expect(statusOf({ value: "done", span: null, confidence: 1 }, { value: null, span: null, confidence: 1 })).toBe("unbacked");
  });
});
