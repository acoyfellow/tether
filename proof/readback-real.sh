#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/.."
dir=experiments/readback-real
fail=0
step() { printf '%-48s' "$1"; }
ok() { echo PASS; }
bad() { echo "FAIL  $1"; fail=1; }

step "1. contract committed before labels"
contract=$(git log --format=%ct --diff-filter=A -1 -- "$dir/CONTRACT.md")
labels=$(git log --format=%ct --diff-filter=A -1 -- "$dir/labels.json")
contract_after_edit=$(git log --format=%H -- "$dir/CONTRACT.md" | wc -l | tr -d ' ')
if [ -n "$contract" ] && [ -n "$labels" ] && [ "$contract" -le "$labels" ] && git merge-base --is-ancestor "$(git log --format=%H --diff-filter=A -1 -- "$dir/CONTRACT.md")" "$(git log --format=%H --diff-filter=A -1 -- "$dir/labels.json")"; then ok; else bad "contract=$contract labels=$labels"; fi

step "2. at least 40 definite labels"
definite=$(python3 -c "import json;print(sum(r['label'] in ('landed','not_landed') for r in json.load(open('$dir/labels.json'))))" 2>/dev/null || echo 0)
[ "$definite" -ge 40 ] && ok || bad "$definite definite"

step "3. score recomputes to the receipt"
if python3 "$dir/score.py" "$dir/labels.json" > /tmp/readback-real-score.json 2>/dev/null && python3 -c "
import json,sys
a=json.load(open('/tmp/readback-real-score.json')); b=json.load(open('$dir/receipt.json'))
sys.exit(0 if a==b else 1)"; then ok; else bad "score.py output differs from receipt.json"; fi

verdict=$(python3 -c "import json;print(json.load(open('$dir/receipt.json'))['verdict'])" 2>/dev/null || echo none)

step "4. README and FINDINGS state the verdict ($verdict)"
if [ -f "$dir/FINDINGS.md" ] && grep -qi "readback on real writes: $verdict" README.md && grep -qi "verdict: $verdict" "$dir/FINDINGS.md"; then ok; else bad "missing 'Readback on real writes: $verdict' in README or 'Verdict: $verdict' in FINDINGS"; fi

step "5. go branch: extension test and A/B receipt"
if [ "$verdict" != go ]; then echo "SKIP (verdict $verdict)"; elif [ -f "$dir/ab-receipt.json" ] && node --experimental-strip-types --test "$dir/extension/readback.test.ts" >/dev/null 2>&1; then ok; else bad "go needs $dir/ab-receipt.json and a passing extension test"; fi

exit $fail
