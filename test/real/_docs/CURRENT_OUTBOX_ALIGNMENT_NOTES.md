# path: test/real/_docs/CURRENT_OUTBOX_ALIGNMENT_NOTES.md

# Current outbox alignment notes

Этот пакет — **практический мост** между profile-first тестами и текущей схемой `uri-runner-next`.

## Что уже заложено

Helper ожидает и нормализует:
- `STATUS.json`
- `SNAPSHOT.txt`
- `REPORT/`
- fallback `outbox/outbox.json`

## Что нужно проверить в проекте сразу после распаковки

1. Совпадает ли реальная CLI-команда запуска с:
   - `node bin/uri.cjs audit --inbox ... --outbox ... --workspace ...`
2. Совпадает ли текущий `RUNBOOK.yaml` с шаблоном в `cases/*/INBOX/RUNBOOK.yaml`
3. Какие точные поля лежат в `STATUS.json`
4. Какие файлы стабильно появляются в `REPORT/`

## Самая быстрая адаптация

Если реальные тесты падают из-за формы outbox, а не из-за поведения URI:
- не переписывать все тесты,
- а править только `normalize-current-outbox.mjs`.

## Минимальный критерий истины для MVP

Для первого этапа достаточно стабильно проверять:
- `status`
- `attempts`
- наличие `STATUS.json`
- наличие `SNAPSHOT.txt`
- наличие `REPORT/`
- stop reason, если она стабильно сериализуется
