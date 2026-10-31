# Experiment: read-back on model-written writes

Frozen before generation, code or data. Changes after this commit go in a Deviations section with a reason.

## Claim

For a write in the real `cloudflare-agent` `execute` shape, the read-back check needs only two things:

- the `execute` code the model wrote;
- the `changes` list the model wrote.

It derives the read from the write path, the same rule as `deriveReadCode` in `revert-agent.ts`. Then it compares each model-written `after` against the read result. This catches writes that did not land, without flagging honest writes.

Experiment 1 gave the check a clean target and clean values. This experiment gives it only what the model wrote.

## Input shape

The `execute` tool arguments, as defined in `cloudflare-mcp-agent.ts`:

- `code`: JavaScript that calls `cloudflare.request({ method, path, body })`. `accountId` is in scope.
- `changes`: `[{ key, before?, after? }]`. Every value is a string, as the tool description requires.

## Tasks

Four write tasks on Customer 0. Each is phrased as a user request:

| Task | Write |
|---|---|
| `kv_rename` | Rename a KV namespace to a given title |
| `script_tags` | Set the tags on a Worker script |
| `script_logpush` | Turn Logpush on or off for a Worker script |
| `cron` | Set the cron schedule of a Worker script |

## Generation

- For each task, Haiku gets:
  - the real `execute` tool description text;
  - the `changes` field description;
  - the user request.
- It returns `{ code, changes }`.
- There are 5 variants per task with different target values: 20 honest writes.
- The output is frozen to `writes.json` before any run. Outputs that are not valid JSON are recorded and excluded, and the count is reported.

## Faults

Each honest write gets one faulty copy, 20 in all. The faults are spread evenly over three kinds, and the recorded `code` and `changes` stay the model's original in every case:

- `never_applied`: the write is not run.
- `wrong_value`: the same call is made with a changed value.
- `overwritten`: the write is run, then another value is written.

## Execution

- The model's `code` runs in a function whose `cloudflare.request` is a real `fetch` to the Cloudflare API on Customer 0.
- The read is the GET of the write's first path.
- The read runs right after the write.

## Comparison

`after` is a string, so a field holds when its string form matches the value in the read result. The value is found by `key`, using these steps in order:

1. a top-level field;
2. a field one level down;
3. for an array result, membership.

No per-task rules are allowed.

## Metrics

Computed by `score.ts` from the per-case files.

- Recall on faulty writes.
- False alarm rate on honest writes.
- Derivable rate: the share of writes for which a GET path was found and returned 2xx.

## Pass rule

In each of 3 runs:

1. Derivable ≥ 90%.
2. Recall ≥ 95% on derivable writes.
3. False alarm ≤ 10% on derivable honest writes.

## Disproof exit

If false alarm is above 10%, the claim is disproven for model-written `changes`. Each false alarm is listed with its key and the observed shape. That list is the spec for what `changes` would need to carry.

## Deviations

1. The first generation pass was rejected before any run. Haiku answered 11 of 20 prompts with "I have no execute tool" because the prompt read as a request to act. The prompt now states that the model writes the call arguments and the harness runs them. The first pass is kept as `writes-pass1.json`.
2. The probe run (`runs/probe`, kept, not scored) showed two harness faults:
   - The fault value appended `x`, which made cron strings invalid. The fault write was then rejected, so `never_applied` and `wrong_value` cases never left the resource at a different value. Fault values now change the last digit of a string, or flip a boolean. A case counts as valid only when the reset write and the fault write returned 2xx.
   - The harness did not record whether the model's own write was accepted. Two `script_logpush` writes used a request the API rejected, and that is an `api_ok` catch, not a read-back result. Each case now records the status of every setup write. `score.ts` reports cases whose honest write the API rejected as `write_rejected` and leaves them out of recall and false alarm.
