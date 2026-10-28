import { Effect } from "effect";
import { Option } from "effect";
import { Schema } from "effect";
import { Command } from "foldkit";
import { Message } from "./message";
import { Proof, Result } from "./model";

const decodeResult = Schema.decodeUnknownEffect(Result);

const ErrorReply = Schema.Struct({ error: Schema.String });

const decodeErrorReply = Schema.decodeUnknownOption(ErrorReply);

const FALLBACK_REASON = "The check failed.";

export const RunCheck = Command.define("RunCheck", {
  args: { claim: Schema.String, evidence: Schema.String },
  messages: [Message.Checked, Message.FailedCheck],
  execute: ({ claim, evidence }) =>
    Effect.gen(function* () {
      const started = performance.now();

      const response = yield* Effect.tryPromise(() =>
        fetch("api/check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ claim, evidence }),
        }),
      );

      const reply: unknown = yield* Effect.tryPromise(() => response.json());

      if (!response.ok) return Message.FailedCheck({ reason: Option.getOrElse(Option.map(decodeErrorReply(reply), (failure) => failure.error), () => FALLBACK_REASON) });
      const result = yield* decodeResult(reply);

      return Message.Checked({ result, ms: Math.round(performance.now() - started) });
    }).pipe(Effect.catch(() => Effect.succeed(Message.FailedCheck({ reason: "Could not reach the checker." })))),
});

const decodeProof = Schema.decodeUnknownEffect(Proof);

export const LoadProof = Command.define("LoadProof", {
  args: {},
  messages: [Message.LoadedProof, Message.MissingProof],
  execute: () =>
    Effect.gen(function* () {
      const response = yield* Effect.tryPromise(() => fetch("proof.json"));

      const reply: unknown = yield* Effect.tryPromise(() => response.json());

      const proof = yield* decodeProof(reply);

      return Message.LoadedProof({ proof });
    }).pipe(Effect.catch(() => Effect.succeed(Message.MissingProof()))),
});
