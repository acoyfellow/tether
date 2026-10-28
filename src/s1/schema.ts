import { Schema } from "effect";

const Span = Schema.Tuple([Schema.Number, Schema.Number]);

export const ScalarAnswer = Schema.Struct({
  type: Schema.Literals(["number", "duration", "date", "time", "datetime"]),
  p_null: Schema.Number,
  confidence: Schema.Number,
  value: Schema.NullOr(Schema.Union([Schema.Number, Schema.String])),
  unit: Schema.optional(Schema.String),
});

export const TextAnswer = Schema.Struct({
  type: Schema.Literal("text"),
  p_null: Schema.Number,
  confidence: Schema.Number,
  value: Schema.NullOr(Schema.String),
  span: Schema.optional(Span),
});

export const ListAnswer = Schema.Struct({
  type: Schema.Literal("list"),
  confidence: Schema.Number,
  value: Schema.Array(Schema.Union([Schema.String, Schema.Number])),
  spans: Schema.optional(Schema.Array(Span)),
});

export const EstimateAnswer = Schema.Struct({
  type: Schema.Literal("estimate"),
  value: Schema.Number,
  median: Schema.Number,
  p10: Schema.Number,
  p90: Schema.Number,
});

export const FieldAnswer = Schema.Union([ScalarAnswer, TextAnswer, ListAnswer, EstimateAnswer]);

export type FieldAnswer = typeof FieldAnswer.Type;

export const ExtractResponse = Schema.Struct({
  answers: Schema.Record(Schema.String, FieldAnswer),
  usage: Schema.Struct({ input_tokens: Schema.Number }),
});

export type ExtractResponse = typeof ExtractResponse.Type;

export const NoulAnswer = Schema.Struct({ type: Schema.Literal("noul"), noul: Schema.Number });

export const ChoiceAnswer = Schema.Struct({
  type: Schema.Literal("choice"),
  choice: Schema.String,
  probabilities: Schema.Record(Schema.String, Schema.Number),
  confidence: Schema.Number,
});

export const ScoreAnswer = Schema.Struct({
  type: Schema.Literal("score"),
  score: Schema.Number,
  probabilities: Schema.Record(Schema.String, Schema.Number),
  confidence: Schema.Number,
});

export const DecisionAnswer = Schema.Union([NoulAnswer, ChoiceAnswer, ScoreAnswer]);

export type DecisionAnswer = typeof DecisionAnswer.Type;

export const DecideResponse = Schema.Struct({
  answers: Schema.Record(Schema.String, DecisionAnswer),
  usage: Schema.Struct({ input_tokens: Schema.Number }),
});

export type DecideResponse = typeof DecideResponse.Type;
