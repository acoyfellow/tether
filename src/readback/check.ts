export type Target =
  | { kind: "kv"; namespace: string; key: string }
  | { kind: "d1"; database: string; table: string; id: string }
  | { kind: "worker_tags"; script: string };

export type Change = { key: string; before: unknown; after: unknown };

export type WriteRecord = {
  tool_name: string;
  account_id: string;
  target: Target;
  changes: Change[];
  result: unknown;
};

export type FieldEvidence = { key: string; expected: unknown; observed: unknown; held: boolean };

export type Verdict = { verdict: "held" | "broken"; fields: FieldEvidence[] };

export type Compare = (key: string, expected: unknown, observed: unknown) => boolean;

export const sameValue: Compare = (_key, expected, observed) =>
  JSON.stringify(expected) === JSON.stringify(observed);

export function judge(
  record: WriteRecord,
  observed: Record<string, unknown>,
  compare: Compare = sameValue,
): Verdict {
  const fields = record.changes.map((change) => ({
    key: change.key,
    expected: change.after,
    observed: observed[change.key] ?? null,
    held: compare(change.key, change.after, observed[change.key] ?? null),
  }));
  return { verdict: fields.every((field) => field.held) ? "held" : "broken", fields };
}

export function apiOk(record: WriteRecord): Verdict {
  const result = record.result as Record<string, unknown> | null;
  const failed =
    result === null ||
    typeof result !== "object" ||
    result["isError"] === true ||
    result["ok"] === false ||
    result["success"] === false ||
    result["status"] === "error";
  return { verdict: failed ? "broken" : "held", fields: [] };
}
