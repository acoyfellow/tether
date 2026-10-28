import type { DecisionAnswer, FieldAnswer } from "./schema.ts";

export type Present = {
  readonly kind: "present";
  readonly value: string | number | ReadonlyArray<string | number>;
  readonly confidence: number;
  readonly span: readonly [number, number] | null;
};

export type Ranged = {
  readonly kind: "range";
  readonly median: number;
  readonly low: number;
  readonly high: number;
};

export type Absent = { readonly kind: "absent"; readonly pNull: number };

export type Reading = Present | Ranged | Absent;

export const readField = (answer: FieldAnswer): Reading => {
  switch (answer.type) {
    case "estimate":
      return { kind: "range", median: answer.median, low: answer.p10, high: answer.p90 };
    case "list":
      return answer.value.length === 0
        ? { kind: "absent", pNull: 1 - answer.confidence }
        : { kind: "present", value: answer.value, confidence: answer.confidence, span: answer.spans?.[0] ?? null };
    case "text":
      return answer.value === null
        ? { kind: "absent", pNull: answer.p_null }
        : { kind: "present", value: answer.value, confidence: answer.confidence, span: answer.span ?? null };
    default:
      return answer.value === null
        ? { kind: "absent", pNull: answer.p_null }
        : { kind: "present", value: answer.value, confidence: answer.confidence, span: null };
  }
};

export const probabilityYes = (answer: DecisionAnswer): number => {
  switch (answer.type) {
    case "noul":
      return answer.noul;
    case "score":
      return answer.score;
    case "choice":
      return answer.confidence;
  }
};
