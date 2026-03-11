# URI Runner Next — Command Loader Pack

Содержимое архива:

- `src/commands/load-commands.cjs`
- `src/uram/pipeline.cjs`
- `doc/commands/command-loading.md`

## Что добавлено

1. Автозагрузка команд из `src/commands/<library>/<command>.cjs`
2. Поддержка `profile: scenario` в `pipeline.cjs`
3. Автоматическая регистрация команд через `CommandRegistry`
4. Русскоязычная документация по загрузке команд

## Важно

Этот пакет рассчитан на уже существующие файлы:

- `src/commands/command-registry.cjs`
- `src/uram/scenario-parser.cjs`
- `src/uram/scenario-executor.cjs`

## Примечание

В текущем варианте для `scenario`-режима outbox записывается как JSON-файл
во временный путь outbox. Это рабочий временный мост, но его позже лучше
заменить на полноценную упаковку в zip-артефакт.
