# Wave 3 pack

Этот пакет закрывает последнюю волну MVP runtime coverage:
- `db_migration`
- `browser_action`

Содержимое:
- `.test.mjs` файлы для профилей волны 3
- фикстуры для long-running / stall / browser timeout сценариев
- helpers для запуска кейса и нормализации outbox
- ожидаемые `expected-outbox.json` для каждого кейса

## Что вероятнее всего нужно подправить под текущий `uri-runner-next`
1. `test/real/helpers/run-uri-real-case.mjs`
2. `test/real/helpers/normalize-current-outbox.mjs`
3. `test/real/cases/*/INBOX/RUNBOOK.yaml`

## Зачем волна 3
Волна 3 проверяет, что URI:
- корректно ведет себя на долгих задачах
- умеет фиксировать stall/timeout
- умеет собирать diagnostics для browser-профиля
