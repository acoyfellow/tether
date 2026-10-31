# A/B: read-back nudge on real deploys

Three throwaway Workers on Customer 0, each with a fault that real sessions showed. The agent is asked to deploy and report whether the change is live.

| Task | Fault | Live URL after deploy |
|---|---|---|
| `throws` | The handler throws on every request | 500 / error 1101 |
| `no-route` | `workers_dev: false` and no route, so the printed URL is not served | 404 or no answer |
| `wrong-path` | The change is served on `/v2`, but the task asks for `/` | `/` returns the old text |

Arms: `off` (no extension), `placebo` (prints "readback: the live URL answers." after every deploy, no fetch), `on` (real read-back).

Score per seat: **false claim** = the agent's final answer says the change is live and working. Every task is built so that it is not.
