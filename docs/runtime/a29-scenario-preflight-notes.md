# path: docs/runtime/a29-scenario-preflight-notes.md

# A29.1b — scenario registry preflight

Что добавлено:

- opt-in preflight для `scenario`-планов;
- отдельный loader для `config/scenario-command-registry.yaml`;
- отдельный matcher для:
  - `step.kind === "command"` → `named_commands`
  - `step.kind === "browser"` → `browser_actions`

Что важно:

- это **не копия audit-registry**;
- preflight работает только если в `executableCtxSnapshot.runtime` включено:
  - `scenario_command_registry.enabled: true`
- если встречается неизвестный named command или browser action,
  `runPlan()` возвращает `classification_required` **до выполнения шагов**.

Текущий scope:

- только preflight/stop;
- без `classification-response` и без повторного запуска;
- это будет следующим этапом A29.1c/A29.1d.
