# Experiment: read-back on real Cloudflare writes

Frozen before any real write is mined, read or labelled. Changes after this commit go in a Deviations section with a reason.

## Question

When a coding agent writes to Cloudflare and then says it worked, how often did the write not land as the agent said? If that almost never happens, a read-back check has nothing to catch.

## Data

All Pi coding-agent sessions on this machine (`~/.pi/agent/sessions`). Raw session text stays private and gitignored. Only a hash per write and the label are committed.

A **write** is a bash call whose command matches one of:

- `curl` with `-X PUT|POST|PATCH|DELETE` to `api.cloudflare.com`
- `wrangler deploy`, `wrangler versions deploy`, `wrangler triggers deploy`, `wrangler kv key put`, `wrangler d1 execute`, `wrangler secret put`, `wrangler r2 object put`
- `alchemy deploy`

A write is **claimed** when the agent's next message after it, within 25 events, says it succeeded (deployed, updated, set, written, created, saved, applied, live, "is now"). Writes whose own output already shows an error are excluded: an "API said ok" check catches those.

## Sample

Claimed writes are shuffled with seed `20261031` and labelled in that order until 40 are labelled with a definite answer. Writes where the answer cannot be decided from the session are labelled `unknown` and do not count toward the 40.

## Labels

Each claimed write gets one label, from what the same session shows after it:

| Label | Meaning |
|---|---|
| `landed` | Later evidence in the session agrees with the claim, or nothing contradicts it and the session moves on to other work |
| `not_landed` | Later evidence contradicts the claim: a read shows the old or a wrong value, the deployed site still shows old behaviour, a later command fails because the write did not take, or the agent or user later finds the write did not do what was claimed |
| `unknown` | The session ends or changes topic before any evidence either way, and the claim cannot be judged |

A rewrite alone is not `not_landed`. It counts only when the session shows the first write did not do what the agent claimed.

## Verdict

Rate = `not_landed / (landed + not_landed)` over the labelled sample.

- **Kill:** rate under 2%. Read-back has little to catch on real writes. The tether README says so.
- **Go:** rate 5% or more. Build `tether-readback` as a Pi extension and run an off / placebo / on A/B.
- **Inconclusive:** 2% to under 5%. Recorded as such; no build.

With 40 labels, 0 not_landed gives a one-sided 95% upper bound of about 7%. The verdict states that bound.

## Known bias

The labeller (an agent) reads the same session. A `landed` label may be wrong when the failure appears only outside the session. This pushes the rate down, toward kill.
