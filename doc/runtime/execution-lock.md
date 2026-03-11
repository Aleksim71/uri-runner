# Execution Lock Patch

Что добавлено:

- `src/uram/execution-lock.cjs`
- обновлённый `src/uram/pipeline.cjs`

## Идея

Во время исполнения проекта URI создаёт lock-файл:

```text
<uramRoot>/locks/<project>.lock
```

Пока lock существует, второй запуск того же проекта должен завершиться ошибкой:

```text
[uri] run: execution locked for project "<project>"
```

## Что делает pipeline

1. получает `project`
2. получает `runId`
3. захватывает lock
4. выполняет engine
5. в `finally` освобождает lock

## Важно

Это минимальный v1:

- без stale-lock recovery
- без force unlock
- без проверки жив ли pid
