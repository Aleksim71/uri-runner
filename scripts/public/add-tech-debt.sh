#!/usr/bin/env bash
set -e

URAM="$HOME/uram"
DOCS="$URAM/docs"
FILE="$DOCS/TECH_DEBT.md"

mkdir -p "$DOCS"

if [ ! -f "$FILE" ]; then
cat > "$FILE" <<'EOF'
# Technical Debt — URAM / URI Runner

Этот файл содержит идеи улучшений, которые **отложены**, чтобы не усложнять архитектуру преждевременно.

---

## URAM pipeline simplification (future optimization)

Idea:
Simplify uri run pipeline by reducing file operations and internal state handling.

Potential benefits:
- reduce uri run code size by ~30–40%
- simplify history management
- reduce filesystem operations

Reason postponed:
Core URAM pipeline (v1) is not yet fully implemented.

Decision:
Revisit after:
- uri run implemented
- history/index.jsonl implemented
- at least 20–30 URAM runs executed.

Status:
POSTPONED
EOF

echo "TECH_DEBT.md created."

else
echo "TECH_DEBT.md already exists."
fi

echo
echo "Current docs structure:"
tree "$DOCS" 2>/dev/null || ls -R "$DOCS"
