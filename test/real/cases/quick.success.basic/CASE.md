# path: test/real/cases/quick.success.basic/CASE.md

# quick.success.basic

Этот кейс использует минимальный `audit`-runbook и проверяет только profile contract через нормализованный outbox.

## Что нужно подогнать, если схема проекта изменилась

- `INBOX/RUNBOOK.yaml`
- helper `normalize-current-outbox.mjs`
- test expectations в `EXPECTED/expected-outbox.json`
