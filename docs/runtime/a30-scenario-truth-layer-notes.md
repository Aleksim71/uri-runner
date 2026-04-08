# path: docs/runtime/a30-scenario-truth-layer-notes.md

# A30 — scenario truth / real layer

## Что зафиксировано

После завершения A30 в проекте появился полноценный `scenario` truth / real layer в `test/real`.

Базовый профиль:
- `test/real/scenario.profile.real.test.mjs`

Подтверждённые truth-cases:
1. `scenario.success.basic`
2. `scenario.classification_required.unknown_named`
3. `scenario.classification_response.applies_and_executes`
4. `scenario.classification_required.unknown_browser_action`
5. `scenario.classification_response.browser_applies_and_executes`

## Что именно теперь считается source of truth

Для `scenario`-слоя источником истины считаются не только unit-тесты, но и полный truth-cycle:

`inbox.zip -> watch --once -> outbox.zip`

Это означает:
- проверяется не только `runPlan()` или helper-ы;
- проверяется реальный watcher pipeline;
- проверяется итоговый outbox и его truth-snapshot;
- regression по статусам `success / classification_required / error` теперь ловится на real-слое.

## Named command truth

Named-command линия зафиксирована как truth в трёх состояниях:
- known command -> `success`
- unknown command -> `classification_required`
- classification-response -> registry patch -> rerun preflight -> `success`

## Browser-flow truth

Browser-flow линия зафиксирована как truth в двух состояниях:
- unknown browser-flow command omitted from scenario registry -> `classification_required`
- classification-response closes missing browser-flow command -> `success`

Важный нюанс цикла:
- browser-flow в реальном pipeline не всегда проявляется как `kind: browser` на уровне classification request;
- часть browser-flow шагов в preflight приходит как `command-shaped` (`browser.session.start`, `browser.page.open`, `browser.diagnostics.collect`, ...).

Поэтому truth-assertions для browser-flow должны опираться на фактическую форму `outbox.json`, а не на предположение о внутреннем shape шага.

## Практический итог

После A30 изменение `scenario`-кода нельзя считать подтверждённым только потому, что:
- зелёные unit-тесты;
- зелёный ручной smoke;
- зелёный live-прогон вне `test/real`.

Для `scenario`-слоя подтверждение теперь должно проходить через `test/real/scenario.profile.real.test.mjs`.
