# Meta Pipeline — A16 / File Delivery Report V1

Этот документ фиксирует, что новый слой отчёта по обязательным файлам
не создаёт отдельный meta-runtime рядом с существующим pipeline.

## Что должно остаться неизменным

Сохраняются существующие поверхности:

- запись `history/index.jsonl` / history index
- создание и обновление `outbox.latest.zip`
- единый flow для `processed / history / latest`
- legacy fallback на `profile`, если он уже предусмотрен текущим путём

## Что добавляется

В meta-путь допускается добавление новых данных handoff-слоя:

- `fileDeliveryReport` внутри `outbox.json`
- `provided/project-tree.txt` при `fileDeliveryReport.ok=false`
- summary по requested files без изменения A15 result-source-of-truth

## Чего делать нельзя

Нельзя:

- строить вторую альтернативную truth-model для результата run
- вычислять отдельный итог успеха, не согласованный с A15 result layer
- переносить Required Files Delivery Report в watcher / intake-gate слой
- ломать старый success-case с `provided`

## Правильная схема

Нормальный путь должен выглядеть так:

COMPILE
→ VALIDATE
→ EXECUTE
→ NORMALIZE RESULT
→ COLLECT / CLASSIFY REQUIRED FILES
→ FINALIZE OUTBOX / HISTORY / SURFACES

## Практический вывод

Meta pipeline должен лишь протянуть и сохранить новые поля handoff-слоя,
а не переосмысливать их заново.


## Статус реализации

A16 завершён: новые поля handoff-слоя протягиваются до `outbox.json`, а обычный smoke success-case остаётся совместимым.
