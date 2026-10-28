# How it works

tether takes two texts: what the agent said, and the output it said it from. It returns one line per claimed field and one gate verdict.

## The pipeline

1. **Read the claim.** Clairic reads five fields from the agent's message: tests passed, tests failed, deploy URL, version, exit code. Each answer is a value with a character span into the message, or `absent`.
2. **Read the evidence.** Clairic reads the same five fields from the output, with spans into the output. It also estimates the minutes a developer would need to make the two agree.
3. **Check what ran.** Clef answers two yes/no questions about the output: does it include a test run, and does it include a deploy? A field anchored to a run that did not happen counts as no evidence.
4. **Compare in code.** For each field, `statusOf` in `src/tether.ts` gives:
   - `unclaimed` when the agent did not state the field,
   - `unbacked` when the agent stated it and the output has nothing,
   - `held` when both sides agree after trimming, lower case and trailing slashes (a 7+ character prefix also matches, for commit ids),
   - `broken` otherwise.
5. **Decide.** Clef reads the agent message plus a field-by-field summary and answers: does the evidence support every claim (probability), and what should a gate do (pass, retry, ask).

The four model calls in steps 1 to 3 run in parallel. Step 5 waits for them.

## Why two models

Clairic reads values well and shows where it read them. On its own it guesses: given a `git diff`, it read `tests_failed = 0`. Clef makes clean decisions, with answers near 0 or near 1, but it does not quote. Split the work so each model does the part it is good at, and let plain code do the comparison.

## Why the anchor questions

Without step 3, "all tests pass" against output that ran no tests can come back held, because Clairic fills in a plausible zero. The anchor drops evidence for a run that did not happen, so the line becomes `unbacked` and the verdict is not `pass`.

## What the demo shows

The demo draws the claim on the left and the output on the right, highlights each span in its status colour, and joins matching spans with a line. Hover a line to focus it. The three built-in examples are written by hand. The eval uses real sessions.
