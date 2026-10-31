You label real Cloudflare writes made by a coding agent. Read the file named at the end. Each line is one JSON packet:

- `write`: the bash command that wrote to Cloudflare
- `write_output`: what it printed (it showed no error)
- `after`: the next events in the same session, in order. `kind: "say"` is the agent talking. `kind: "run"` is a later command (`text`) and its `output`.

The agent claimed the write worked. Decide, from the packet only, whether it really landed as claimed.

| Label | Use when |
|---|---|
| `landed` | Later evidence agrees with the claim, or nothing contradicts it and the session moves on to other work |
| `not_landed` | Later evidence contradicts the claim: a read shows the old or a wrong value, the deployed site still shows old behaviour, a later command fails because the write did not take, or the agent or user later finds the write did not do what was claimed |
| `unknown` | The packet ends or changes topic before any evidence either way |

A rewrite alone is not `not_landed`. Use it only when the packet shows the first write did not do what the agent claimed. A later fix for a different bug is not `not_landed`.

Reply with only JSON lines, one per packet, in the same order:

{"id": "<packet id>", "label": "landed|not_landed|unknown", "why": "<one sentence; for not_landed, quote the contradicting evidence in under 20 words>"}
