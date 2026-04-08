# path: docs/runtime/a31-scenario-truth-source-of-truth.md

# A31 — scenario truth layer as source of truth

## Зафиксированное состояние

На момент этого sync:
- A28 закрыт
- A29 закрыт
- A30.1 закрыт
- A30.2 закрыт
- A30.2a закрыт

Подтверждено:
- `test/real/scenario.profile.real.test.mjs` зелёный
- `npm test` зелёный
- browser runtime fallback fix встроен и покрыт unit + real

## Что считается canonical truth для scenario

Для `scenario`-слоя canonical truth теперь состоит из двух частей:

1. Unit / focused correctness:
   - compile
   - preflight
   - classification-response apply
   - runtime browser helpers

2. Real / watcher pipeline:
   - `test/real/scenario.profile.real.test.mjs`

Если между ними есть расхождение, приоритет проверки регрессии должен отдаваться real pipeline, потому что именно он подтверждает итоговое поведение `watch --once`.

## Текущая truth-матрица

### Named
- success
- classification_required
- classification_response -> success

### Browser-flow
- classification_required
- classification_response -> success

## Важный operational вывод

Для `scenario classification-response` в real/watch-контуре надёжнее всего сработал inline вариант через:

`executableCtx.runtime.scenario_command_registry.classification_response`

Это поведение уже подтверждено truth-layer и должно считаться зафиксированным engineering note до появления более сильной унификации path-based response loading.

## Что делать дальше

Следующий разумный слой после A31:
- обновить Piligrim / chat-move summary;
- отметить `scenario.profile.real.test.mjs` как обязательный gate для scenario-изменений;
- при желании вынести отдельный checklist по truth-regressions для named/browser-flow линий.
