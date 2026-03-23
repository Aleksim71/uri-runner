# URI_WATCH_POLICY_BRANCH_ADAPTER_V1

## Корректирующий пакет после шага 10

По выводу тестов видно, что после шага 10 произошёл runtime-регресс
в scenario watcher full cycle. По одному логу нельзя доказать точную причину,
но безопасная гипотеза такая: пакет шага 10 повторно перезаписал terminal helper files
и этим задел существующий watcher/runtime путь.

## Что делает этот пакет

- восстанавливает terminal approval files в согласованном виде
- оставляет `handleWatchStepPolicy(...)` как отдельный additive helper
- не врезается в watcher entrypoint
- не меняет execution branch

## Как применять

Распаковать архив поверх проекта и повторно запустить:

```bash
npm test
```

## Важно

Это fix-пакет. Он не добавляет новую интеграцию.
Он возвращает шаг 10 к безопасной форме: helper есть, но runtime entrypoint не тронут.
