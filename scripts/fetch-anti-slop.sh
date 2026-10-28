#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
commit=13909c9e07590f5a85d93c62712259fe14a883f7
dest=tools/oxlint/anti-slop
[ -f "$dest/index.ts" ] && exit 0
tmp=$(mktemp -d)
curl -sL "https://codeload.github.com/dmmulroy/anti-slop/tar.gz/$commit" | tar -xz -C "$tmp"
mkdir -p "$(dirname "$dest")"
cp -R "$tmp"/anti-slop-*/skills/install-anti-slop/assets/anti-slop "$dest"
rm -rf "$tmp"
