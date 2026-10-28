import type { Reading } from "./s1/index.ts";
import type { ClaimSpec } from "./claims.ts";

export type Span = readonly [number, number];

export type Side = {
  readonly value: string | null;
  readonly span: Span | null;
  readonly confidence: number;
};

export type LineStatus = "held" | "broken" | "unbacked" | "unclaimed";

export type Line = {
  readonly id: string;
  readonly label: string;
  readonly claim: Side;
  readonly evidence: Side;
  readonly status: LineStatus;
};

const show = (value: string | number | ReadonlyArray<string | number>) =>
  Array.isArray(value) ? value.join(", ") : String(value);

export const sideOf = (reading: Reading): Side => {
  switch (reading.kind) {
    case "present":
      return { value: show(reading.value), span: reading.span, confidence: reading.confidence };
    case "range":
      return { value: `${Math.round(reading.low)}-${Math.round(reading.high)}`, span: null, confidence: 0.8 };
    case "absent":
      return { value: null, span: null, confidence: reading.pNull };
  }
};

const normalize = (value: string) => value.trim().toLowerCase().replace(/\/+$/, "");

const agrees = (claimed: string, found: string) => {
  const a = normalize(claimed);
  const b = normalize(found);

  return a === b || (a.length >= 7 && b.startsWith(a)) || (b.length >= 7 && a.startsWith(b));
};

export const statusOf = (claim: Side, evidence: Side): LineStatus => {
  if (claim.value === null) return "unclaimed";

  if (evidence.value === null) return "unbacked";

  return agrees(claim.value, evidence.value) ? "held" : "broken";
};

const ABSENT: Side = { value: null, span: null, confidence: 1 };

export const tetherLine = (spec: ClaimSpec, claimed: Reading, found: Reading, anchored: boolean): Line => {
  const claim = sideOf(claimed);
  const evidence = anchored ? sideOf(found) : ABSENT;

  return { id: spec.id, label: spec.label, claim, evidence, status: statusOf(claim, evidence) };
};

export type Tally = { readonly held: number; readonly broken: number; readonly unbacked: number };

export const tally = (lines: ReadonlyArray<Line>): Tally => ({
  held: lines.filter((line) => line.status === "held").length,
  broken: lines.filter((line) => line.status === "broken").length,
  unbacked: lines.filter((line) => line.status === "unbacked").length,
});

export const summarize = (lines: ReadonlyArray<Line>): string =>
  lines
    .flatMap((line) => {
      if (line.status === "unclaimed") return [];

      const found = line.evidence.value ?? "nothing in the evidence";

      return [`${line.label}: claimed ${line.claim.value}, evidence shows ${found} (${line.status})`];
    })
    .join("\n");
