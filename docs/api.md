# API

One endpoint.

## POST /api/check

Request body, JSON:

| Field | Type | Rule |
|---|---|---|
| `claim` | string | the agent's message, 1 to 12,000 characters |
| `evidence` | string | the command output, 1 to 12,000 characters |

Response, `200`:

```json
{
  "lines": [
    {
      "id": "tests_passed",
      "label": "Tests passed",
      "claim": { "value": "42", "span": [11, 13], "confidence": 0.57 },
      "evidence": { "value": "40", "span": [14, 16], "confidence": 0.57 },
      "status": "broken"
    }
  ],
  "tally": { "held": 0, "broken": 1, "unbacked": 0 },
  "verdict": { "supported": 0.02, "action": "retry", "actionProbabilities": { "pass": 0.01, "retry": 0.95, "ask": 0.04 } },
  "fixMinutes": { "median": 12, "low": 5, "high": 30 },
  "inputTokens": 2147
}
```

- `span` is `[start, end)` in characters into that side's text, or `null`.
- `status` is `held`, `broken`, `unbacked` or `unclaimed`.
- `verdict.action` is `pass`, `retry` or `ask`. Treat anything but `pass` as a flag.
- `fixMinutes` is `null` unless a line is broken or unbacked.
- Do not use `confidence` for decisions. See [Limits](/docs/limits).

Errors:

| Status | When |
|---|---|
| `400` | body is not JSON, or a field is missing, empty or too long |
| `404` | any other `/api/` path |
| `502` | a model call failed or replied in an unexpected shape, after retries on capacity errors |

## Use it as a gate

```sh
action=$(curl -s "$TETHER/api/check" -H 'content-type: application/json' \
  --data "$(jq -n --arg c "$CLAIM" --arg e "$OUTPUT" '{claim:$c,evidence:$e}')" | jq -r .verdict.action)
[ "$action" = "pass" ] || exit 1
```

## Self-host

The Worker needs a Workers AI binding named `AI` and two variables, `S1_EXTRACT_MODEL` and `S1_DECIDE_MODEL`. Model ids are read from config, never from source. `alchemy.run.ts` deploys it.
