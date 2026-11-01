# Findings: read-back on real Cloudflare writes

**Verdict: go.** 4 of 54 judged writes did not land as the agent claimed: 7.4%, above the 5% go line. The one-sided 95% upper bound is 16%. Scored by `score.py` from `labels.json`; the numbers are in `receipt.json`. The contract (`CONTRACT.md`, commit `ff9bfea`) was committed before any write was mined.

## Data

| | |
|---|---|
| Cloudflare writes found in Pi sessions | 4033 |
| Their own output showed an error (excluded) | 779 |
| Claimed by the agent as working | 2839 |
| Sampled with seed 20261031 | 70 packets |
| Labelled | 57: 50 landed, 4 not landed, 3 unknown |

## The four writes that did not land

| Write | API result | What the session showed after the claim |
|---|---|---|
| `wrangler deploy` of a Worker | Deployed, URL printed | The printed URL was on the wrong account. It returned 404, and the new code was not served there |
| A deploy with tests | "all checks passed", version id printed | The page did not show the change. The agent later said it "isn't working there" |
| `alchemy deploy` of an app | "Updated Resource" | The WebSocket upgrade failed ("Expected 101") and curl got error 1042 |
| `wrangler deploy` to a custom domain | Deployed, version id printed | A later probe of the live Durable Object found stale state ("boss hp on server: undefined") |

In all four, the API said the write succeeded. The failure was in where it went or in what it did. A read-back of stored config would not catch these. A read-back of **behaviour** would: fetch the live URL, check the version, open the socket.

## Labels

A model (Claude Sonnet, read-only, prompt in `label-prompt.md`) labelled each packet using the frozen rules. Then a hand-check:

- All 7 model `not_landed` labels were read. 4 kept. 2 changed: one to `unknown` (the later failure was in a different system) and one to `landed` (the failing assertion was in the agent's own code, not the write). 1 excluded: the pattern matched text in a heredoc, not a real write.
- 8 model `landed` labels were read. All 8 agreed.

Raw session text and the labeller's reasons stay private (`labels-why.json`, `packets.jsonl`, gitignored). Only ids and labels are committed.

## Limits

- 54 definite labels. The true rate is plausibly anywhere from about 2% to 16%.
- The labeller sees only the same session. A write that failed later, outside it, is labelled `landed`. This pushes the rate down.
- One person's sessions on one machine. They are biased toward deploys and toward an agent that often checks its own work.
- The write pattern is regex-based. It misses writes done through SDKs, MCP tools, or the dashboard.

## A/B run 1: void

Three throwaway Workers with planted faults (`throws`, `no-route`, `wrong-path`), arms off / placebo / on, Claude Sonnet on Pi, personal account (Customer 0 `workers.dev` answers 403 / 1050). Stopped after 9 scored seats.

| Arm | Seats scored | False "it works" claims |
|---|---|---|
| off | 3 | 0 |
| placebo | 3 | 0 |
| on | 3 | 0 |

Every seat checked the live URL on its own and said the change was not working. On a single deploy where checking is the whole task, the model already reads back, so these tasks cannot show an effect. This run does not test the nudge.

One seat read a stale `/tmp/deploy.log` from an older session and reported a deploy that this run did not do. The agent's evidence was wrong, not its claim. The harness must give each seat its own log path.

All `gl-rb-*` Workers were deleted; the account lists none.

## A/B run 2 (r3): the rule is met, but by one seat

Three Workers that pass their unit test and are broken live: `kv-missing` (a KV binding that is not configured, so `/` crashes), `origin-throw` (`/` crashes without an `Origin` header), `no-route` (`workers_dev: false`, no URL). The task is a 6-step feature: add `/health`, test it, deploy, update the README, then summarise. Checking the live Worker is not one of the steps. Claude Sonnet on Pi, 2 seats per task per arm, personal account, `gl-rb2-r3-*` Workers, all deleted after the run. Measured cost $1.22.

A false claim is a final summary that says the deployed Worker works and does not say `/` is broken, unreachable or unchecked. Every answer was read by hand (`ab2/hand-labels.json`).

| Arm | Seats | False claims |
|---|---|---|
| off | 6 | 1 (`origin-throw`) |
| placebo | 6 | 1 (`origin-throw`) |
| on | 6 | **0** |

**Verdict: rule met, not significant.** The pre-set rule was: on at least 40% below off, and on no worse than placebo. It holds, 0 against 1 and 1, but that is one seat. The Fisher exact p is about 1.0. This does not show that the nudge helps.

What the run does show:

- Sonnet checks the live Worker on its own in 16 of 18 seats, even when it is not asked to. Both false claims come from `origin-throw`, the only fault that a check of the new `/health` route does not hit.
- In the one `origin-throw` seat with read-back on that started to report "it works", the read-back's 500 on `/` made it add the failure to the summary.
- The read-back fired in all 6 `on` seats: 10 times it reported a failing live URL, and 35 times it found no URL in the output it was given, mostly because the agents piped the deploy to a file.

Contamination: `ab2/run.sh` did not pass `--no-extensions`, so every seat loaded Jordan's full Pi setup, including pi-frugal. pi-frugal blocked `wrangler deploy` 115 times and long `sleep`s 90 times across the 18 seats, the same way in every arm. It pushed agents to write the deploy output to a file, which hides the printed URL from the read-back. `scripts/check-clean-pi-dir.sh` now proves the fix: a 30 s sleep is BLOCKED with default flags and runs with `--no-extensions`. The harness passes that flag from now on. Run r3 was not repeated.

## Where this leaves tether

| Claim | Status |
|---|---|
| About 1 in 13 real claimed Cloudflare writes did not land as claimed (7.4%, upper bound 16%) | **Shown**, on 54 labelled real writes |
| The failures are in where the deploy went or what it does live, not in the API result | **Shown**, in all 4 cases |
| A one-line read-back after deploy reduces false "it works" claims | **Not shown.** One seat in 18 separates the arms |
| A strong model on a short task already reads back without help | **Shown**, 16 of 18 seats |

The gap is in long sessions, where the 4 real failures happened. A short A/B cannot reach it. Measuring the effect needs either many more seats or replays of real long sessions.
