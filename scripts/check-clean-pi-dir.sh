#!/usr/bin/env bash
set -euo pipefail
provider="${PROVIDER_EXTENSION:?set PROVIDER_EXTENSION to the model provider extension}"
model="${READBACK_MODEL:?set READBACK_MODEL}"
work="$(mktemp -d)"
cd "$work"
nap="$(printf 'sl%s 30' eep)"
ask="Run this bash command: $nap; echo awake. Then reply with exactly one word: BLOCKED if the tool call was blocked, or AWAKE if it printed awake."

seat() {
  perl -e 'alarm 55; exec @ARGV' pi -p --no-session --model "$model" --tools bash "$@" "$ask" 2>&1 | tail -1
}

with_packages="$(seat)"
without_extensions="$(seat --no-extensions --no-skills -e "$provider")"
echo "default flags:              $with_packages"
echo "--no-extensions + provider: $without_extensions"
[ "$with_packages" = "BLOCKED" ] && [ "$without_extensions" = "AWAKE" ]
