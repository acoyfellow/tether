#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

host="https://tether.customer0.dev"
fail() { echo "GATE FAIL: $*" >&2; exit 1; }

echo "== fit"
shared="$HOME/cloudflare/.context/bin/spike-fit.ts"
[ ! -f "$shared" ] || cmp -s fit/spike-fit.ts "$shared" || fail "fit/spike-fit.ts differs from the shared copy; run spike-fit-sync"
bun fit/spike-fit.ts . || fail "fit"

echo "== code"
npx tsc -p . >/dev/null || fail "typecheck"
npx tsc -p tsconfig.eval.json >/dev/null || fail "eval typecheck"
npx vitest run >/dev/null || fail "tests"
npm run build >/dev/null || fail "build"
npm run lint >/dev/null || fail "lint"

echo "== eval"
bun eval/verify-frozen.ts || fail "eval files do not match eval/frozen.json"
committed=$(bun -e 'const r=require("./eval/receipt.json");console.log(JSON.stringify([r.verdict,r.bySystem]))')
bun eval/score.ts >/dev/null || fail "score"
recomputed=$(bun -e 'const r=require("./eval/receipt.json");console.log(JSON.stringify([r.verdict,r.bySystem]))')
git checkout -- eval/receipt.json
[ "$committed" = "$recomputed" ] || fail "committed receipt does not match the recomputed scores"
verdict=$(bun -e 'console.log(require("./eval/receipt.json").verdict)')
case "$verdict" in proven|disproven) echo "verdict: $verdict" ;; *) fail "verdict is $verdict" ;; esac

echo "== docs"
for section in "## Why" "## What it does" "## Quick start" "## Proof" "## Limits"; do
  grep -q "^$section" README.md || fail "README missing $section"
done
for page in docs/*.md; do
  slug=$(basename "$page" .md)
  grep -q "/docs/$slug" public/llms.txt || fail "llms.txt does not list $slug"
done

echo "== live"
for path in / /llms.txt $(ls docs/*.md | sed 's#^docs/#/docs/#; s#\.md$##'); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 20 "$host$path")
  [ "$code" = "200" ] || fail "$host$path answered $code"
done
number=$(bun -e 'const r=require("./eval/receipt.json");console.log(Math.min(...r.bySystem.tether.map(s=>s.recall)))')
curl -s -m 20 "$host/" | grep -q "$verdict" || fail "live page does not show the verdict"
curl -s -m 20 "$host/" | grep -q "$number" || fail "live page does not show tether recall $number"

echo "== screenshots"
for shot in receipts/desktop.png receipts/mobile.png; do
  [ -s "$shot" ] || fail "missing $shot"
done

echo "== public"
[ -z "$(git status --porcelain)" ] || fail "tree not clean"
local_head=$(git rev-parse HEAD)
remote_head=$(git ls-remote https://github.com/acoyfellow/tether.git refs/heads/main | cut -f1)
[ "$local_head" = "$remote_head" ] || fail "GitHub main $remote_head != local $local_head"
clone=$(mktemp -d)
git clone -q https://github.com/acoyfellow/tether.git "$clone/tether"
(cd "$clone/tether" && npm ci >/dev/null && npx tsc -p . >/dev/null && npx vitest run >/dev/null && npm run build >/dev/null) || fail "clean clone does not pass"
rm -rf "$clone"

echo "== hygiene"
git ls-files | grep -E '(^|/)\.real/' && fail ".real is tracked"
if git grep -nE 'cfdata\.org|@cloudflare\.com|cf-access-client-secret|BEGIN [A-Z ]*PRIVATE KEY|[A-Za-z0-9_-]{40}\.[A-Za-z0-9_-]{20,}' -- . ':!package-lock.json' ':!tools/' ':!proof/gate.sh'; then
  fail "secret or employee-internal text in tree"
fi
bun eval/no-raw-text.ts || fail "raw session text found in tree"

echo "== shape doc"
grep -q "tether" /Users/jcoeyman/cloudflare/.context/MY_REPO_SHAPE_V3.md || fail "MY_REPO_SHAPE_V3.md does not name tether"

echo "tether gate: pass"
