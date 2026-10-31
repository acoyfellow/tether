# Experiment: read-back v2, stricter changes and a path-aware comparison

Frozen before generation and before any run. It follows `readback-model`, which failed with 2/17 false alarms, both from shape mismatches.

## Changes from readback-model, and only these

1. The `changes` description sent to the model adds one sentence: "Write a list value as a JSON array string, for example [\"a\",\"b\"]. Write key as the field name as it appears in the API response, or a dotted path such as schedules.0.cron."
2. The comparison resolves a dotted key (`a.b.0.c`) against the read result before the existing rules. It also resolves `[n]` index syntax as a dotted segment.
3. New target values are used, so this is not the data the fix was designed from. The variants are n = 5..9 instead of 0..4, and the Worker scripts are `gl-sb-6`..`gl-sb-10`.

Everything else is unchanged from `readback-model/CONTRACT.md`, including the fault kinds, the exclusion of writes the API rejected, and the metrics.

## Pass rule

In each of 3 runs:

1. Derivable ≥ 90%.
2. Recall ≥ 95%.
3. False alarm ≤ 10%.

## Disproof exit

If false alarm is still above 10%, the stricter wording is not enough. Each false alarm is listed.
