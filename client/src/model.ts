import { Schema } from "effect";
import { defineTaggedUnion } from "foldkit/schema";

const Span = Schema.NullOr(Schema.Tuple([Schema.Number, Schema.Number]));

export const Side = Schema.Struct({ value: Schema.NullOr(Schema.String), span: Span, confidence: Schema.Number });

export const LineStatus = Schema.Literals(["held", "broken", "unbacked", "unclaimed"]);

export type LineStatus = typeof LineStatus.Type;

export const Line = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  claim: Side,
  evidence: Side,
  status: LineStatus,
});

export type Line = typeof Line.Type;

export const Result = Schema.Struct({
  lines: Schema.Array(Line),
  tally: Schema.Struct({ held: Schema.Number, broken: Schema.Number, unbacked: Schema.Number }),
  verdict: Schema.Struct({
    supported: Schema.Number,
    action: Schema.String,
    actionProbabilities: Schema.Record(Schema.String, Schema.Number),
  }),
  fixMinutes: Schema.NullOr(Schema.Struct({ median: Schema.Number, low: Schema.Number, high: Schema.Number })),
  inputTokens: Schema.Number,
});

export type Result = typeof Result.Type;

export const Run = defineTaggedUnion({
  Idle: {},
  Checking: {},
  Checked: { result: Result, ms: Schema.Number },
  Failed: { reason: Schema.String },
});

export type Run = typeof Run.Type;

const Scores = Schema.Struct({ recall: Schema.String, precision: Schema.String, falseFlag: Schema.String });

export const Proof = Schema.Struct({ verdict: Schema.String, tether: Scores, clefAlone: Scores, regex: Scores });

export type Proof = typeof Proof.Type;

export const Model = Schema.Struct({
  proof: Schema.NullOr(Proof),
  claim: Schema.String,
  evidence: Schema.String,
  focus: Schema.NullOr(Schema.String),
  run: Run,
});

export type Model = typeof Model.Type;
