#!/usr/bin/env bash
set -euo pipefail

SANDBOX_ROOT="${1:-}"

if [[ -z "$SANDBOX_ROOT" ]]; then
  SANDBOX_ROOT="$(mktemp -d /tmp/uri-sandbox-XXXXXX)"
fi

mkdir -p \
  "$SANDBOX_ROOT/Downloads" \
  "$SANDBOX_ROOT/Inbox" \
  "$SANDBOX_ROOT/processed"

touch "$SANDBOX_ROOT/watch.log"
touch "$SANDBOX_ROOT/last_run.txt"

node test/sandbox/write-sandbox-config.cjs "$SANDBOX_ROOT" >/dev/null

echo "$SANDBOX_ROOT"
