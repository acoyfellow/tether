import json
import math
import sys

KILL_BELOW = 0.02
GO_AT = 0.05
NEEDED = 40


def upper_bound(failures, n, confidence=0.95):
    if n == 0:
        return 1.0
    low, high = failures / n, 1.0
    for _ in range(60):
        mid = (low + high) / 2
        tail = sum(math.comb(n, k) * mid**k * (1 - mid) ** (n - k) for k in range(failures + 1))
        if tail > 1 - confidence:
            low = mid
        else:
            high = mid
    return high


def score(labels):
    definite = [row for row in labels if row["label"] in ("landed", "not_landed")]
    not_landed = sum(row["label"] == "not_landed" for row in definite)
    n = len(definite)
    rate = not_landed / n if n else None
    if n < NEEDED:
        verdict = "incomplete"
    elif rate < KILL_BELOW:
        verdict = "kill"
    elif rate >= GO_AT:
        verdict = "go"
    else:
        verdict = "inconclusive"
    return {
        "labelled": len(labels),
        "definite": n,
        "landed": n - not_landed,
        "not_landed": not_landed,
        "unknown": len(labels) - n,
        "rate": None if rate is None else round(rate, 4),
        "upper_95": round(upper_bound(not_landed, n), 4),
        "verdict": verdict,
    }


if __name__ == "__main__":
    print(json.dumps(score(json.load(open(sys.argv[1]))), indent=1))
