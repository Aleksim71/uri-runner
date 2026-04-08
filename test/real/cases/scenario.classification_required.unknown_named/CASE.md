# path: test/real/cases/scenario.classification_required.unknown_named/CASE.md

# scenario.classification_required.unknown_named

Цель: проверить полный truth-cycle `inbox.zip -> watch --once -> outbox.zip` для scenario-step, который реально существует как project command, но отсутствует в `scenario-command-registry`.

Ожидание:
- шаг не исполняется вслепую;
- pipeline возвращает `classification_required`;
- в REPORT/ или provided/ появляются:
  - `classification-request.json`
  - `classification-request.yaml`
