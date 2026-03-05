#!/usr/bin/env bash
set -e

URAM="$HOME/uram"

echo "Creating URAM structure at $URAM"

mkdir -p "$URAM/Inbox/processed"
mkdir -p "$URAM/docs"
mkdir -p "$URAM/tempasiBox/history"
mkdir -p "$URAM/abonasiBox/history"

cat > "$URAM/docs/URAM.md" <<'EOF'
# URAM — URI Runner Execution Environment

URAM — рабочая среда для URI Runner.
Используется для обмена пакетами между AI и локальными проектами.

Root:
~/uram

Structure

~/uram/
  Inbox/
    inbox.zip
    processed/

  tempasiBox/
    outbox.latest.zip
    history/
      *.outbox.zip
      index.jsonl

  abonasiBox/
    outbox.latest.zip
    history/
      *.outbox.zip
      index.jsonl

  docs/
    URAM.md


Inbox
-----

Inbox содержит входной пакет:

inbox.zip

Внутри должен быть:

RUNBOOK.yaml


Pipeline
--------

1. uri читает ~/uram/Inbox/inbox.zip
2. извлекает RUNBOOK.yaml
3. определяет project
4. запускает профиль
5. пишет outbox в <project>Box
6. обновляет history
7. перемещает inbox в Inbox/processed


Command
-------

URI Runner запускается:

uri run

или

uri fass


History
-------

Каждый прогон сохраняется:

history/

Формат файла:

YYYY-MM-DD_HH-mm-ss__<profile>__<OK|FAIL>__<run_id>.outbox.zip


Index
-----

Метаданные прогонов:

history/index.jsonl
EOF


cat > "$URAM/docs/RUNBOOK.example.yaml" <<'EOF'
version: 1
project: tempasi
cwd: /home/aleksim/tempasi
profile: audit
EOF

echo "URAM ready."
echo
echo "Structure:"
echo "$URAM"
tree -L 3 "$URAM" 2>/dev/null || ls -R "$URAM"
