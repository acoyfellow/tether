import { Context } from "effect";
import { Data } from "effect";
import { Effect } from "effect";
import { Layer } from "effect";
import { Schedule } from "effect";
import { Schema } from "effect";
import { DecideResponse, ExtractResponse } from "./schema.ts";
import type { DecideRequest, ExtractRequest } from "./spec.ts";

export class ModelCallFailed extends Data.TaggedError("ModelCallFailed")<{
  readonly model: string;
  readonly message: string;
}> {}

export class ModelReplyInvalid extends Data.TaggedError("ModelReplyInvalid")<{
  readonly model: string;
  readonly message: string;
}> {}

export type S1Error = ModelCallFailed | ModelReplyInvalid;

export type JsonValue = string | number | boolean | null | ReadonlyArray<JsonValue> | { readonly [key: string]: JsonValue | undefined };

export type AiRunner = { run(model: string, input: JsonValue): Promise<JsonValue> };

export type S1Models = { readonly extract: string; readonly decide: string };

export type S1Client = {
  readonly extract: (request: ExtractRequest) => Effect.Effect<ExtractResponse, S1Error>;
  readonly decide: (request: DecideRequest) => Effect.Effect<DecideResponse, S1Error>;
};

export class S1 extends Context.Service<S1, S1Client>()("s1/S1") {}

const describe = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

const CAPACITY = /capacity|3040|429|overloaded/i;

export const isCapacityError = (error: ModelCallFailed) => CAPACITY.test(error.message);

const retryCapacity = Schedule.exponential("200 millis");

const CAPACITY_RETRIES = 4;

const callModel = <A>(ai: AiRunner, model: string, input: JsonValue, decode: (raw: JsonValue) => Effect.Effect<A, Schema.SchemaError>) =>
  Effect.tryPromise({
    try: () => ai.run(model, input),
    catch: (cause) => new ModelCallFailed({ model, message: describe(cause) }),
  }).pipe(
    Effect.retry({ schedule: retryCapacity, times: CAPACITY_RETRIES, while: isCapacityError }),
    Effect.flatMap((raw) =>
      decode(raw).pipe(Effect.mapError((error) => new ModelReplyInvalid({ model, message: describe(error) }))),
    ),
  );

export const makeS1 = (ai: AiRunner, models: S1Models): S1Client => {
  const decodeExtract = Schema.decodeUnknownEffect(ExtractResponse);
  const decodeDecide = Schema.decodeUnknownEffect(DecideResponse);

  return {
    extract: (request) => callModel(ai, models.extract, request, decodeExtract),
    decide: (request) => callModel(ai, models.decide, request, decodeDecide),
  };
};

export const s1Layer = (ai: AiRunner, models: S1Models) => Layer.succeed(S1, makeS1(ai, models));
