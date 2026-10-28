import type { FieldSpec, NoulQuestion } from "./s1/index.ts";

export type ClaimKind = "count" | "text" | "duration";

export type AnchorId = "test_run" | "deploy_run";

export type ClaimSpec = {
  readonly id: string;
  readonly anchor: AnchorId | null;
  readonly label: string;
  readonly kind: ClaimKind;
  readonly asClaimed: string;
  readonly inEvidence: string;
};

export const CLAIMS: ReadonlyArray<ClaimSpec> = [
  {
    id: "tests_passed",
    anchor: "test_run",
    label: "Tests passed",
    kind: "count",
    asClaimed: "Number of tests the agent's message says passed",
    inEvidence: "Number of passing tests in the test runner output",
  },
  {
    id: "tests_failed",
    anchor: "test_run",
    label: "Tests failed",
    kind: "count",
    asClaimed: "Number of tests the agent's message says failed",
    inEvidence: "Number of failing tests in the test runner output",
  },
  {
    id: "deploy_url",
    anchor: "deploy_run",
    label: "Deployed to",
    kind: "text",
    asClaimed: "URL the agent's message says it deployed to",
    inEvidence: "URL the deploy output says was deployed",
  },
  {
    id: "version",
    anchor: "deploy_run",
    label: "Version",
    kind: "text",
    asClaimed: "Version or commit id the agent's message names",
    inEvidence: "Version id the deploy output reports",
  },
  {
    id: "exit_code",
    anchor: null,
    label: "Exit code",
    kind: "count",
    asClaimed: "Exit code the agent's message reports",
    inEvidence: "Exit code of the last command in the output",
  },
];

const fieldFor = (kind: ClaimKind, instructions: string): FieldSpec => {
  switch (kind) {
    case "count":
      return { type: "number", instructions, integer: true };
    case "duration":
      return { type: "duration", instructions, unit: "seconds" };
    case "text":
      return { type: "text", instructions };
  }
};

export const claimedFields = (claims: ReadonlyArray<ClaimSpec>): Record<string, FieldSpec> =>
  Object.fromEntries(claims.map((claim) => [claim.id, fieldFor(claim.kind, claim.asClaimed)]));

export const evidenceFields = (claims: ReadonlyArray<ClaimSpec>): Record<string, FieldSpec> =>
  Object.fromEntries(claims.map((claim) => [claim.id, fieldFor(claim.kind, claim.inEvidence)]));

export const ANCHORS: Readonly<Record<AnchorId, NoulQuestion>> = {
  test_run: { type: "noul", instructions: "Does this output include the result of running a test suite?" },
  deploy_run: { type: "noul", instructions: "Does this output include the result of a deploy command?" },
};

export const ANCHOR_THRESHOLD = 0.5;

export const FIX_ESTIMATE: FieldSpec = {
  type: "estimate",
  instructions: "Minutes a developer would need to make the evidence match the claim",
  unit: "minutes",
  min: 1,
  max: 600,
  scale: "log",
};
