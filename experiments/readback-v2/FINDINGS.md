# Findings: read-back v2

**Result: pass, 3 of 3 runs.** Scored by `score.ts` from `runs/r1`–`r3`. The full numbers are in `receipt.json`.

| Metric | r1 | r2 | r3 | Rule |
|---|---|---|---|---|
| Derivable | 30/30 | 30/30 | 30/30 | ≥ 90% |
| Recall | 15/15 | 15/15 | 15/15 | ≥ 95% |
| False alarm | 0/15 | 0/15 | 0/15 | ≤ 10% |

The fix was one more sentence in the `changes` description plus dotted-path lookup in the comparison. It was tested on new target values, not the cases it was designed from.

## Limits

- `script_logpush`: the API rejected all 5 of the model's writes this time (3 of 5 in readback-model). The model keeps using `PATCH .../settings`, which this API refuses. The `api_ok` rule catches that, so the read-back is not needed there. The cost is that only 3 of the 4 tasks were scored.
- 15 faulty and 15 honest per run is small. With 0 false alarms in 15 honest writes, the one-sided 95% upper bound on the true rate is about 18%.
- The faults are injected. This does not measure how often real writes fail.
