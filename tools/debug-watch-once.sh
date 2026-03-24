#!/usr/bin/env bash
# path: tools/debug-watch-once.sh
set -euo pipefail

PROJECT_ROOT="${1:-$PWD}"
DOWNLOADS_DIR="${2:-$HOME/Загрузки}"

echo '=== PROJECT ROOT ==='
echo "$PROJECT_ROOT"
echo
echo '=== DOWNLOADS DIR ==='
echo "$DOWNLOADS_DIR"
echo

echo '=== BEFORE: DOWNLOADS ==='
ls -la "$DOWNLOADS_DIR" | sed -n '1,40p' || true
echo

echo '=== BEFORE: INTAKE ==='
find "$PROJECT_ROOT/intake" -maxdepth 4 -type f | sort || true
echo

echo '=== BEFORE: RUNTIME WATCH ==='
find "$PROJECT_ROOT/runtime/watch" -maxdepth 6 -type f | sort || true
echo

echo '=== RUN: uri watch --once ==='
(cd "$PROJECT_ROOT" && uri watch --once) || true
echo

echo '=== AFTER: DOWNLOADS ==='
ls -la "$DOWNLOADS_DIR" | sed -n '1,40p' || true
echo

echo '=== AFTER: INTAKE ==='
find "$PROJECT_ROOT/intake" -maxdepth 4 -type f | sort || true
echo

echo '=== AFTER: RUNTIME WATCH ==='
find "$PROJECT_ROOT/runtime/watch" -maxdepth 6 -type f | sort || true
echo

echo '=== LAST RUN ==='
cat "$PROJECT_ROOT/runtime/watch/last_run.txt" || true
echo

echo '=== WATCH CONFIG ==='
cat "$PROJECT_ROOT/config/watch.json" || true
echo
