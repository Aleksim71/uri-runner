# path: test/real/cases/classification_required.unknown_command/CASE.md

# classification_required.unknown_command

Цель: проверить полный truth-cycle `inbox.zip -> watch --once -> outbox.zip` для случая, когда в audit-runbook встречается неизвестная terminal-команда и включён `command_registry` preflight.

Ожидание:
- команда **не исполняется**;
- pipeline возвращает `classification_required`;
- в `REPORT/` появляются:
  - `classification-request.json`
  - `classification-request.yaml`
