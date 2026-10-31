# Findings: read-back on model-written writes

**Result: fails by the frozen rule, in 3 of 3 runs.** Scored by `score.ts` from the per-case files in `runs/r1`–`r3`. The full numbers are in `receipt.json`.

| Metric | r1 | r2 | r3 | Rule |
|---|---|---|---|---|
| Derivable (read path found, GET 2xx) | 34/34 | 34/34 | 34/34 | ≥ 90% |
| Recall on faulty writes | 17/17 | 17/17 | 17/17 | ≥ 95% |
| False alarm on honest writes | 2/17 (11.8%) | 2/17 | 2/17 | ≤ 10% |

The 3 runs gave the same results. The data is deterministic, so the noise band is 0.

## The two false alarms

Both writes landed. The model's `changes` entry described the same value in a different shape from the API:

| Case | Model wrote | API returned |
|---|---|---|
| `script_tags-3` | `key: "tags"`, `after: "team-3,tier-3"` (comma list) | `["team-3","tier-3"]` |
| `cron-2` | `key: "schedules[0].cron"` (a path) | `{"schedules":[{"cron":"3 * * * *"}]}` |

Under the disproof exit, these two are the spec for what `changes` would need to carry:

1. A list value is written as a JSON array string, as 4 of the 5 `script_tags` writes already do.
2. A key is a field name, or a dotted path that the comparison resolves.

Either a stricter `changes` description or a comparison that parses comma lists and dotted paths would clear both. Both fixes are hypotheses until a new frozen run tests them.

## Excluded from scoring

`script_logpush`: the model sent `PATCH .../settings` for 3 of 5 writes, and the API rejected every one. The `api_ok` rule catches those. They are listed in `receipt.json` and are not counted as read-back results. This leaves 34 of 40 cases valid.

## What held

- Every faulty write that left the resource at a different value was caught: 51 of 51 over 3 runs.
- The model's own `code` gave a readable GET path in 34 of 34 valid cases.
- The model's own `after` values were enough to decide, with no target given.
