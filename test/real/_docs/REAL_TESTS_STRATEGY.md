# path: test/real/_docs/REAL_TESTS_STRATEGY.md

# URI real tests — стартовая структура

## Идея

Тестируем не отдельные строки команд, а **профили исполнения**:

- `quick`
- `service_start`
- `db_query`
- `db_migration`
- `browser_action`
- `interactive_risk`

Минимальный цикл real test:

1. собрать `inbox.zip`
2. запустить URI
3. получить `outbox.zip`
4. распаковать `outbox.zip`
5. сравнить фактический результат с эталоном

---

## Рекомендуемая структура

```text
test/real/
  _docs/
    REAL_TESTS_STRATEGY.md
  _templates/
    inbox.quick.success/
      META.json
      RUNBOOK.yaml
    inbox.quick.success.zip
  helpers/
    assert-outbox.mjs
    unzip-outbox.mjs
  fixtures/
    interactive/
      prompt-wait.js
  cases/
    quick.success.basic/
      EXPECTED/
        expected-outbox.json
    quick.non_zero_exit/
      EXPECTED/
        expected-outbox.json
    interactive_risk.prompt_detected/
      EXPECTED/
        expected-outbox.json
```

---

## Что считается эталоном на первом этапе

На MVP лучше сравнивать не весь `outbox`, а **нормализованный JSON**:

- `status`
- `attempts`
- `step.profile`
- `step.exitCode`
- `step.stopReason`
- наличие ключевых артефактов

Не стоит сразу сравнивать:

- абсолютные пути
- точные timestamp
- случайные `runId`
- полные логи побайтно

---

## Как развивать дальше

### Волна 1
- `quick.success.basic`
- `quick.non_zero_exit`
- `interactive_risk.prompt_detected`

### Волна 2
- `service_start.ready_success`
- `service_start.not_ready_timeout`
- `db_query.success`
- `db_query.retry_then_fail`

### Волна 3
- `db_migration.success`
- `db_migration.stall_detected`
- `browser_action.success`
- `browser_action.timeout_with_diagnostics`

---

## Важно

Шаблоны в этой папке — это **стартовый каркас под профильные real tests**.
Если текущая схема `RUNBOOK.yaml` в проекте отличается, надо подстроить только формат входа, а не сам подход:

**команда → профиль → reaction contract → expected outbox**
