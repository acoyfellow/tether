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
