# Scenario Body Specification v1

Документ описывает формат сценария выполнения URI.

Сценарий хранится в теле runbook или context-файла и определяет
последовательность выполнения команд.

------------------------------------------------------------------------

# Общая структура

Сценарий состоит из набора шагов.

Каждый шаг вызывает одну команду.

``` yaml
scenario:
  start: validate_meta

steps:

  - id: validate_meta
    command: context.validate-meta
    args:
      zip_path: artifacts/inbox/inbox.zip
    on_success: run_tests
    on_failure: build_audit

  - id: run_tests
    command: test.run-vitest
    args:
      pattern: test/scenarios/**/*.test.mjs
    on_success: pack_outbox
    on_failure: build_audit

  - id: pack_outbox
    command: file.zip
    args:
      source: artifacts/outbox
      target: outbox.zip
    stop: true

  - id: build_audit
    command: context.audit
    args:
      reason: failure
    stop: true
```

------------------------------------------------------------------------

# Структура шага

## id

Уникальный идентификатор шага.

## command

Имя команды.

## args

Аргументы команды.

## on_success

Следующий шаг при успешном выполнении команды.

## on_failure

Следующий шаг при ошибке выполнения.

## if

Условие выполнения шага.

## stop

Останавливает выполнение сценария.
