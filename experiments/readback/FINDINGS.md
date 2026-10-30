# Findings: read-back check

**Result: pass, 3 of 3 runs.** Scored by `score.ts` from the per-case files in `runs/`. The full numbers are in `receipt.json`.

| Metric | r1 | r2 | r3 | Rule |
|---|---|---|---|---|
| Read-back recall, every kind | 1.0 | 1.0 | 1.0 | = 1.0 |
| Read-back false alarm | 0 | 0 | 0 | ≤ 5% |
| "API said ok" recall | 0 | 0 | 0 | < 0.5 |
| Median time per check | 116 ms | 107 ms | 129 ms | < 1 s |
| API calls per check | 1 | 1 | 1 | — |

All 30 faulty writes per run returned `success: true`. The "API said ok" rule passed all of them. One GET per write caught all of them.

## Limits

- The faults are injected. They show that the check catches a write that did not land. They do not show how often real writes fail.
- `target` is given as structured data. In `cloudflare-agent` it would have to be read from the generated code and the `changes` diff. That step is not tested here.
- Only three kinds: KV, D1 and Worker tags. DNS was not possible with this token.
- Reads ran right after the writes, from one location. KV is eventually consistent across locations, and no false alarm from that showed up here.
