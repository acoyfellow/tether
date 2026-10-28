import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import decideFixture from "./fixtures/decide.json" with { type: "json" };
import extractFixture from "./fixtures/extract.json" with { type: "json" };
import { type AiRunner, type JsonValue, ModelCallFailed, ModelReplyInvalid, makeS1, probabilityYes, readField } from "../../src/s1/index.ts";

const models = { extract: "extract-model", decide: "decide-model" };

const replying = (reply: JsonValue): AiRunner => ({ run: async () => reply });

const extractRequest = { state: "log", fields: { passed: { type: "number", instructions: "passed" } } } as const;
const decideRequest = { state: "claim", questions: { ok: { type: "noul", instructions: "ok?" } } } as const;

describe("extract", () => {
  it("decodes a real reply and reads present, absent and ranged fields", async () => {
    const reply = await Effect.runPromise(makeS1(replying(extractFixture), models).extract(extractRequest));
    const answers = reply.answers;
    expect(readField(answers["log_passed"]!)).toMatchObject({ kind: "present", value: 40 });
    expect(readField(answers["claimed_passed"]!)).toMatchObject({ kind: "present", value: 42 });
    expect(readField(answers["deploy_url"]!)).toMatchObject({ kind: "present", value: "https://hark.coey.dev", span: [217, 238] });
    expect(readField(answers["rollback_reason"]!)).toMatchObject({ kind: "absent" });
    expect(readField(answers["fix_minutes"]!)).toMatchObject({ kind: "range" });
    expect(readField(answers["files"]!)).toMatchObject({ kind: "absent" });
  });

  it("never reports a guess as a value when the value is null", async () => {
    const reply = await Effect.runPromise(makeS1(replying(extractFixture), models).extract(extractRequest));
    const reading = readField(reply.answers["rollback_reason"]!);
    expect(reading.kind).toBe("absent");
    expect(JSON.stringify(reading)).not.toContain("7f3a91c");
  });

  it("sends the configured model id", async () => {
    const seen: string[] = [];
    const ai: AiRunner = { run: async (model) => (seen.push(model), extractFixture) };
    await Effect.runPromise(makeS1(ai, models).extract(extractRequest));
    expect(seen).toEqual(["extract-model"]);
  });
});

describe("decide", () => {
  it("decodes noul, choice and score answers", async () => {
    const reply = await Effect.runPromise(makeS1(replying(decideFixture), models).decide(decideRequest));
    expect(probabilityYes(reply.answers["claim_supported"]!)).toBeLessThan(0.05);
    expect(reply.answers["action"]).toMatchObject({ type: "choice", choice: "retry" });
    expect(reply.answers["severity"]).toMatchObject({ type: "score" });
  });
});

describe("failures", () => {
  it("wraps a thrown model call", async () => {
    const ai: AiRunner = { run: async () => { throw new Error("3030: bad body"); } };
    const error = await Effect.runPromise(Effect.flip(makeS1(ai, models).decide(decideRequest)));
    expect(error).toBeInstanceOf(ModelCallFailed);
    expect(error.message).toContain("3030");
  });

  it("rejects a reply with the wrong shape", async () => {
    const error = await Effect.runPromise(Effect.flip(makeS1(replying({ answers: 1 }), models).extract(extractRequest)));
    expect(error).toBeInstanceOf(ModelReplyInvalid);
  });
});

describe("capacity retries", () => {
  it("retries a capacity error and succeeds on a later attempt", async () => {
    let calls = 0;

    const ai = {
      run: async () => {
        calls++;

        if (calls < 3) throw new Error("3040: Capacity temporarily exceeded, please try again.");

        return decideFixture;
      },
    };

    const reply = await Effect.runPromise(makeS1(ai, { extract: "e", decide: "d" }).decide({ state: "s", questions: {} }));
    expect(calls).toBe(3);
    expect(reply.answers).toBeDefined();
  });

  it("does not retry other failures", async () => {
    let calls = 0;
    const ai = { run: async () => { calls++; throw new Error("5007: bad input"); } };
    const exit = await Effect.runPromiseExit(makeS1(ai, { extract: "e", decide: "d" }).decide({ state: "s", questions: {} }));
    expect(exit._tag).toBe("Failure");
    expect(calls).toBe(1);
  });
});
