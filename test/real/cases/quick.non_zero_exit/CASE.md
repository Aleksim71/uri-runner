# path: test/real/cases/quick.non_zero_exit/CASE.md

# quick.non_zero_exit

Этот кейс использует минимальный `audit`-runbook и проверяет только profile contract через нормализованный outbox.

## Что нужно подогнать, если схема проекта изменилась

- `INBOX/RUNBOOK.yaml`
- helper `normalize-current-outbox.mjs`
- test expectations в `EXPECTED/expected-outbox.json`
