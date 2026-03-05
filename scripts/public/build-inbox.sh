#!/usr/bin/env bash
set -euo pipefail

PROJECT="${1:-}"
CWD="${2:-}"
PROFILE="${3:-audit}"
MAXDEPTH="${4:-4}"

if [[ -z "$PROJECT" || -z "$CWD" ]]; then
  echo "Usage: build-inbox.sh <project> <cwd> [profile] [maxdepth]"
  exit 2
fi

if [[ ! -d "$CWD" ]]; then
  echo "ERROR: cwd does not exist: $CWD"
  exit 2
fi

if [[ "${CWD:0:1}" != "/" ]]; then
  echo "ERROR: cwd must be an absolute path: $CWD"
  exit 2
fi

URAM_ROOT="${URAM_ROOT:-$HOME/uram}"
INBOX_DIR="$URAM_ROOT/Inbox"
BUILD_DIR="/tmp/uram_inbox_build"
IN_DIR="$BUILD_DIR/INPUT"

rm -rf "$BUILD_DIR"
mkdir -p "$IN_DIR"
mkdir -p "$INBOX_DIR"

cat > "$BUILD_DIR/RUNBOOK.yaml" <<EOF
version: 1
project: $PROJECT
cwd: $CWD
profile: $PROFILE
EOF

{
  echo "PROJECT: $PROJECT"
  echo "TIME: $(date -Iseconds)"
  echo "CWD: $CWD"
  echo
  echo "GIT HEAD:"
  (cd "$CWD" && git rev-parse --short HEAD 2>/dev/null || true)
  echo
  echo "GIT STATUS:"
  (cd "$CWD" && git status -sb 2>/dev/null || true)
} > "$IN_DIR/SNAPSHOT.txt"

(cd "$CWD" && find . -maxdepth "$MAXDEPTH" -type f | sort) > "$IN_DIR/FILE_TREE.txt"

echo "Goal: URAM inbox build." > "$IN_DIR/NOTE.txt"

cd "$BUILD_DIR"
zip -q -r inbox.zip RUNBOOK.yaml INPUT
mv inbox.zip "$INBOX_DIR/inbox.zip"

echo "[uram] inbox ready: $INBOX_DIR/inbox.zip"
