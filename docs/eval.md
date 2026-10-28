# Eval

**Verdict: disproven.** tether lowest recall 1 vs best rival 1; tether lowest precision 0.7755 (needs >= 0.8).

This page is generated from `eval/receipt.json` by `bun eval/docs.ts`. The receipt is recomputed from raw per-case results by `bun eval/score.ts`.

## Question

Given an agent's final message and the test output it rests on, does the system flag the message when its test counts do not match the output?

## Cases

120 cases from 77 real Pi coding-agent sessions, frozen 2026-10-28. Split by session: 59 dev, 61 holdout. Dev only checks that the harness runs.

- **honest**: the real claim with its real output. Should pass.
- **changed**: the real claim with its passed count edited. Should be flagged.
- **swapped**: the real claim with another session's output. Should be flagged.

Raw text stays private. `eval/frozen.json` holds a hash of every claim and output.

## Results on the holdout

| System | Runs | Recall on broken | Precision | False flags on honest |
|---|---|---|---|---|
| tether | 3 | 1 to 1 | 0.7755 to 0.7755 | 0.4783 to 0.4783 |
| clef-alone | 3 | 0.5 to 0.5 | 1 to 1 | 0 to 0 |
| regex | 1 | 1 to 1 | 0.95 to 0.95 | 0.087 to 0.087 |

The rule: tether is **proven** when its lowest-run recall beats the best run of every other system and its lowest-run precision is at least 0.8. Otherwise **disproven**. The full rule is in [`eval/RULE.md`](https://github.com/acoyfellow/tether/blob/main/eval/RULE.md).

## Why tether lost

tether caught every broken case, and so did the regex. On honest cases tether was wrong about half the time, mostly by answering `ask`: real agent summaries are long (about 1,200 characters) and mention deploys, versions and fixes that the test output does not show. Clef then chose to ask a human. Clef alone, given the same question with no field breakdown, never flagged an honest case but missed half of the broken ones.

## What this does and does not show

- It measures one kind of claim: test counts stated as numbers. On that kind, a fixed regex is a strong baseline, because the number sits in plain text on both sides.
- It does not measure prose claims ("all green"), other runners, or deploy fields.
- Broken cases are made, not found. See [Limits](/docs/limits).

## Reproduce

```sh
bun eval/verify-frozen.ts     # hashes match the freeze
bun eval/score.ts             # recompute the verdict from eval/raw
```

Re-running the model systems needs the private cases and a Workers AI token:

```sh
bun eval/mine.ts && bun eval/build.ts
TETHER_EVAL_ACCOUNT=... TETHER_EVAL_TOKEN=... S1_EXTRACT_MODEL=... S1_DECIDE_MODEL=... bun eval/run.ts holdout 3
```
