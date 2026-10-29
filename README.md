# tether

> **Disproven. This did not work.** On a frozen eval of 120 real cases, a regex beat tether (F1 0.974 against 0.874), and tether flagged 48% of honest claims. Purpose-built grounding models such as [LettuceDetect](https://github.com/KRLabsOrg/LettuceDetect) and [MiniCheck](https://github.com/Liyan06/MiniCheck) fit this problem. See [FIT.md](FIT.md).

**Check what an agent says it did against the output it did it with.**

tether reads an agent's final message and the command output behind it. It draws a line from each claim to the evidence for that claim, marks each line held, broken or unbacked, and gives a gate verdict: pass, retry or ask.

> Status: `0.1.0`, public experiment. Live docs and demo at [tether.customer0.dev](https://tether.customer0.dev).

## Why

Coding agents end a task with a summary: "all 42 tests pass, deployed version 7f3a91c". The output it rests on is usually in the same session, a few screens up. Nobody reads both. When the summary rounds up, the error reaches review, or production.

## What it does

```text
agent message ──► Clairic reads each claimed value (tests passed, failed, URL, version, exit code)
command output ─► Clairic reads the same fields, with the character span it read them from
                  Clef answers: did a test run happen? did a deploy happen?
code compares ──► held | broken | unbacked | unclaimed, one line per field
Clef decides ───► pass | retry | ask
```

Each step has one job. Clairic only reads values. Plain code compares them. Clef only answers yes/no or pick-one questions. A value read from output that never ran a test is dropped, so "0 failed" cannot be inferred from a `git diff`.

## Quick start

```sh
git clone https://github.com/acoyfellow/tether.git
cd tether
npm ci
npm test
npm run build
```

Run the Worker against your own Cloudflare account:

```sh
export S1_EXTRACT_MODEL=@cf/cloudflare/clairic S1_DECIDE_MODEL=@cf/cloudflare/clef
npm run dev
```

Call it:

```sh
curl -s localhost:1337/api/check \
  -H 'content-type: application/json' \
  -d '{"claim":"All 42 tests pass.","evidence":"$ bun test\n 40 pass\n 2 fail"}'
```

The reply has `lines` (one per field, with spans into both texts), `tally`, `verdict.action` and `inputTokens`.

## Proof

The eval was frozen before any scored run. Rule, case hashes and harness hashes are in [`eval/`](eval/).

- **Cases:** 120 real claim and output pairs from 77 Pi coding-agent sessions. Raw text stays private; only hashes are committed.
- **Systems:** tether, Clef alone, and a regex that reads the first test count on each side.
- **Verdict: disproven.** On the 61 holdout cases, over 3 runs:

  | System | Recall on broken | Precision | Honest claims flagged |
  |---|---|---|---|
  | tether | 1.0 | 0.776 | 48% |
  | Clef alone | 0.5 | 1.0 | 0% |
  | regex | 1.0 | 0.95 | 8.7% |

  tether catches every broken count, and so does a regex. tether also stops about half of the honest claims, mostly with `ask`: real summaries are long and name things the test output does not show. For gating plain test counts, use the regex. tether's value is the line-by-line view of what each claim rests on, not a better gate.

  Recomputed from raw per-case results by `bun eval/score.ts`. See [`eval/receipt.json`](eval/receipt.json) and the [eval page](https://tether.customer0.dev/docs/eval).

```sh
bash proof/gate.sh
```

The gate checks types, tests, build and lint; the frozen hashes; the recomputed verdict; this README's sections; every docs page in `llms.txt`; the live site; screenshots; that GitHub `main` equals local `HEAD`; a clean clone; and that no secret, employee data or raw session text is in the tree.

## Limits

- As a gate on test counts, tether is beaten by a regex (see Proof). It flags about half of honest real-world summaries.
- Fields are fixed: tests passed, tests failed, deploy URL, version, exit code. Claims outside those fields are not checked.
- Broken cases in the eval are made by editing real claims or swapping real outputs. Real agents in the sampled sessions almost never misstated a count.
- Clairic's confidence number is not used. On exact matches it reads about 0.57.
- Each check is four model calls, about 2,000 input tokens and about one second.
- The live demo is rate limited and runs on the host's account.

## Docs

- [How it works](docs/how-it-works.md)
- [API](docs/api.md)
- [Eval](docs/eval.md)
- [Design](docs/design.md)
- [Limits](docs/limits.md)

## Repository layout

```text
src/            Worker, check pipeline, claim specs, vendored s1 client
client/         Foldkit demo UI
docs/           the site's docs, served as HTML and raw markdown
eval/           frozen rule, case hashes, harness, raw scores, receipt
proof/gate.sh   the release gate
test/           vitest suites with recorded model replies
```

## License

MIT
