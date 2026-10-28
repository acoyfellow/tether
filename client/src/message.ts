import { Schema } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { Proof, Result } from "./model";

export const Message = defineMessageUnion({
  EditedClaim: { value: Schema.String },
  EditedEvidence: { value: Schema.String },
  PickedExample: { index: Schema.Number },
  ClickedCheck: {},
  Checked: { result: Result, ms: Schema.Number },
  FailedCheck: { reason: Schema.String },
  FocusedLine: { id: Schema.NullOr(Schema.String) },
  LoadedProof: { proof: Proof },
  MissingProof: {},
});

export type Message = typeof Message.Type;
