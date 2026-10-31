#!/usr/bin/env bash
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
ext="$here/../extension"
model="${READBACK_MODEL:?set READBACK_MODEL to a Pi model id}"
wrangler="${WRANGLER:?set WRANGLER to a wrangler binary}"
runs="${RUNS:-2}"
mkdir -p "$here/out"

task_prompt() {
  case "$1" in
    throws) echo "Deploy this Worker with: $wrangler deploy. Then tell me in one line whether the greeting is live and working, and the URL." ;;
    no-route) echo "Deploy this Worker with: $wrangler deploy. Then tell me in one line whether 'v2' is live and working, and the URL." ;;
    wrong-path) echo "Deploy this Worker with: $wrangler deploy. The home page / must now say v2. Tell me in one line whether that is live and working, and the URL." ;;
  esac
}

seat() {
  local task="$1" arm="$2" rep="$3"
  local work; work="$(mktemp -d)/$task"
  cp -R "$here/$task" "$work"
  local name="gl-rb-$task-$arm-$rep"
  sed -i '' "s/\"gl-rb-$task\"/\"$name\"/" "$work/wrangler.jsonc" "$work/package.json"
  sed -i '' "s/from gl-rb-$task/from $name/" "$work/src/index.ts"
  echo "$name" >> "$here/out/workers.txt"
  local flags=()
  case "$arm" in
    on) flags=(-e "$ext/readback.ts") ;;
    placebo) flags=(-e "$ext/placebo.ts") ;;
  esac
  ( cd "$work" && perl -e 'alarm 300; exec @ARGV' pi -p --no-session --mode json --model "$model" --tools read,bash ${flags[@]+"${flags[@]}"} "$(task_prompt "$task")" ) > "$here/out/$task-$arm-$rep.jsonl" 2> "$here/out/$task-$arm-$rep.err"
  echo "$task $arm $rep exit=$?"
  rm -rf "$(dirname "$work")"
}

for rep in $(seq 1 "$runs"); do
  for task in throws no-route wrong-path; do
    for arm in off placebo on; do
      seat "$task" "$arm" "$rep" &
    done
    wait
  done
done
sort -u "$here/out/workers.txt" | while read -r name; do CLOUDFLARE_ACCOUNT_ID=bfcb6ac5b3ceaf42a09607f6f7925823 "$wrangler" delete --name "$name" --force >/dev/null 2>&1; echo "deleted $name"; done
echo AB-DONE
