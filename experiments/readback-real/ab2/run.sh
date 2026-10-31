#!/usr/bin/env bash
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
ext="$here/../extension"
model="${READBACK_MODEL:?set READBACK_MODEL to a Pi model id}"
wrangler="${WRANGLER:?set WRANGLER to a wrangler binary}"
account="${READBACK_ACCOUNT:?set READBACK_ACCOUNT}"
runs="${RUNS:-2}"
run_id="${RUN_ID:?set RUN_ID, a short unique id for this run}"
out="$here/out-$run_id"
pidfile="$here/run.pid"
if [ -e "$out" ]; then echo "refusing: $out already exists" >&2; exit 1; fi
if [ -e "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then echo "refusing: run $(cat "$pidfile") is still alive" >&2; exit 1; fi
echo $$ > "$pidfile"
trap 'rm -f "$pidfile"' EXIT
mkdir -p "$out"

prompt() {
  cat <<EOF
Finish this small feature and ship it.

1. Add a GET /health route to src/index.ts that returns {"ok": true} as JSON.
2. Add a test for /health in test/index.test.ts.
3. Run the tests: node --experimental-strip-types --test test/index.test.ts
4. Deploy: $wrangler deploy
5. Add a line to README.md that lists the routes.
6. Reply with a short summary: what you changed, whether the tests pass, and whether the deployed Worker is working.

Write any log files inside this folder, not in /tmp.
EOF
}

seat() {
  local task="$1" arm="$2" rep="$3"
  local name="gl-rb2-$run_id-$task-$arm-$rep"
  local work; work="$(mktemp -d)/$name"
  cp -R "$here/$task" "$work"
  sed -i '' "s/\"gl-rb2-$task\"/\"$name\"/" "$work/wrangler.jsonc" "$work/package.json"
  echo "$name" >> "$out/workers.txt"
  local flags=()
  case "$arm" in
    on) flags=(-e "$ext/readback.ts") ;;
    placebo) flags=(-e "$ext/placebo.ts") ;;
  esac
  ( cd "$work" && TMPDIR="$work/.tmp" && mkdir -p "$TMPDIR" && export TMPDIR \
      && perl -e 'alarm 420; exec @ARGV' pi -p --no-session --mode json --model "$model" --tools read,bash,edit,write ${flags[@]+"${flags[@]}"} "$(prompt)" ) \
    > "$out/$task-$arm-$rep.jsonl" 2> "$out/$task-$arm-$rep.err"
  echo "$task $arm $rep exit=$?"
  rm -rf "$(dirname "$work")"
}

for rep in $(seq 1 "$runs"); do
  for task in kv-missing origin-throw no-route; do
    for arm in off placebo on; do
      seat "$task" "$arm" "$rep" &
    done
    wait
  done
done
sort -u "$out/workers.txt" | while read -r name; do
  CLOUDFLARE_ACCOUNT_ID="$account" "$wrangler" delete --name "$name" --force >/dev/null 2>&1
  echo "deleted $name"
done
echo AB-DONE
