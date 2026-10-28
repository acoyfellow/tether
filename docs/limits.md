# Limits

What tether does not do, and what is not proven.

## Scope

- Five fields only: tests passed, tests failed, deploy URL, version, exit code. A claim like "the bug is fixed" or "nothing else changed" is not checked.
- One message and one output per call. tether does not walk a session to find the output that goes with a claim. The caller picks it.
- 12,000 characters per side. Longer output must be trimmed by the caller. The end of a test run is usually the part that matters.

## Models

- Clairic's per-field `confidence` is not calibrated. It reads about 0.57 on exact matches. tether does not use it, and you should not.
- Clairic can read a plausible value that is not in the text. The anchor questions catch this for test and deploy fields, not for exit codes.
- Each check makes four model calls, about 2,000 input tokens, in about one second.

## Eval

- **The verdict is disproven.** A regex matched tether's recall (1.0) with better precision (0.95 vs 0.776). tether flagged 48% of honest claims, 8 of 11 of them with `ask`, because real summaries name more than the test output shows.

- Broken cases are made by editing a real claim's count or pairing a real claim with another session's output. Real agents in the sampled sessions almost never misstated a test count, so natural errors are rare and not what was measured.
- Eligible pairs had to contain the runner's passed count as a number in the claim. That favours any system that reads numbers, the regex baseline included.
- Only test counts are scored.
- Cases come from one person's sessions with one harness (Pi), mostly TypeScript projects with vitest and bun test.

## Demo

- The live demo runs on the host's Cloudflare account and is rate limited.
- The three examples on the demo page are written by hand. They show the behaviour; they are not evidence.
