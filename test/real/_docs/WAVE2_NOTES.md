# Wave 2 real tests

Этот пакет добавляет первые real tests для профилей:
- `service_start`
- `db_query`

Цель пакета:
1. дать готовый каркас под текущую схему `STATUS.json + SNAPSHOT.txt + REPORT/`
2. свести адаптацию к 3 местам:
   - `test/real/helpers/run-uri-real-case.mjs`
   - `test/real/helpers/normalize-current-outbox.mjs`
   - `test/real/cases/*/INBOX/RUNBOOK.yaml`

## Что здесь есть
- реальные `.test.mjs` файлы
- fixture-скрипты для сервиса и DB-like команд
- кейсы с `INBOX` и `EXPECTED`
- минимальные helper-утилиты

## Что, скорее всего, нужно подправить под проект
- точный CLI вызов `uri`
- точную структуру `RUNBOOK.yaml`
- mapping реального outbox в нормализованный JSON
