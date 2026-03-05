#!/usr/bin/env bash
set -e

INBOX_DIR="$HOME/uram/Inbox"
INBOX_ZIP="$INBOX_DIR/inbox.zip"

mkdir -p "$INBOX_DIR"

# Safe cleanup: remove only the canonical inbox.zip
rm -f "$INBOX_ZIP"

echo "Inbox prepared:"
echo " - removed (if existed): $INBOX_ZIP"
echo " - ready for new download into: $INBOX_DIR"
