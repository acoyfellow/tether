# Design

Decisions, and why.

## One job per step

A single prompt that reads both texts and judges them is easy to write and hard to trust: when it is wrong, there is nothing to look at. tether splits the work. Clairic reads values and says where it read them. Code compares. Clef answers fixed questions. Every line on the page can be traced to a span on each side.

## Comparison is code

Equality of two counts is not a judgement. `statusOf` is ten lines and has unit tests. A model is used where a rule cannot be written: reading a number out of free text, and deciding pass or retry from a summary.

## Model ids are config

The pipeline never names a model. `S1_EXTRACT_MODEL` and `S1_DECIDE_MODEL` are read at deploy time, and the gate fails if a model id appears in source. A different reader or decider can be swapped in without touching the code.

## Effect at the boundary

Requests, model replies and files are decoded with Effect Schema where they enter. Inside, types are trusted. Model call failures are tagged errors (`ModelCallFailed`, `ModelReplyInvalid`) with retries only on capacity errors.

## The page

The demo puts the claim and the evidence side by side because that is the comparison a reviewer has to make. Colour carries status: green held, red broken, amber nothing behind it. Lines join the two spans so the eye does not have to search. The UI is Foldkit with Tailwind: one model, one update, one view.

## The eval came first

The rule, the cases and the harness were hashed before any scored run. Changes after that are logged in `eval/frozen.json` with a reason. The verdict is recomputed from raw per-case results, not copied from a summary.

## What was left out

- No session crawler. Picking the right output for a claim is the caller's job, and the hard part of it depends on the harness.
- No confidence threshold. Clairic's confidence did not separate right from wrong.
- No storage. The Worker keeps nothing.
