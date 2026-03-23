# URI_WATCH_APPROVAL_STEP_V1

## Назначение

Этот шаг мягко подключает approval subsystem к watcher-потоку
для шагов с `policyDecision = ask`, но пока ещё без выполнения команды.

## Что делает

- watcher показывает approval prompt
- watcher читает решение пользователя через stdin
- watcher нормализует ввод
- watcher возвращает итоговое решение:
  - `approved`
  - `denied_by_user`
  - `aborted_by_user`

## Что не делает

- не запускает terminal command
- не пишет trace/outbox
- не меняет execution pipeline
- не обрабатывает auto/deny policy branches

## Новый helper

```js
runWatchApprovalStep(step, options)
```

Возвращает объект:

```json
{
  "stepId": "step-09",
  "policyDecision": "ask",
  "userDecision": "approve",
  "watchState": "approved",
  "prompt": "..."
}
```

## Цель

Подключить живой watcher approval flow
как отдельный узкий слой перед execution integration.
