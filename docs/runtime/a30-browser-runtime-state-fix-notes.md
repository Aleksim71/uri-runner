# path: docs/runtime/a30-browser-runtime-state-fix-notes.md

# A30.2a — browser runtime state fix

## Найденный дефект

Во время доводки `scenario.classification_response.browser_applies_and_executes` был найден реальный runtime-дефект:

- `browser.session.start` мог завершаться успешно;
- но при этом в `runtimeContext.browser.sessions[sessionId].runtime.page` не появлялся usable page adapter;
- следующий `browser.page.open` падал с `BROWSER_PAGE_INSTANCE_MISSING`.

Ошибка проявлялась не на unit-preflight слое, а на полном real/watch pipeline.

## Причина

`start-browser-session.cjs` создавал session state, но при отсутствии endpoint attach не создавал fallback `runtime.page`.

Это делало browser session формально запущенной, но недостаточной для следующего шага `browser.page.open`.

## Что исправлено

В `src/runtime/browser/start-browser-session.cjs` добавлен fallback page adapter для случая, когда:
- endpoint не задан;
- attach к внешнему browser endpoint не выполняется;
- но scenario/browser-flow всё равно должен пройти последовательность start -> open -> diagnostics -> stop.

## Что добавлено в тесты

Добавлен unit-тест:

- `test/unit/start-browser-session.fallback-page-adapter.test.cjs`

Он подтверждает, что без endpoint attach:
- session стартует успешно;
- `runtime.page` создаётся;
- `runtime.page.goto(...)` callable и возвращает expected result shape.

## Почему это важно

Это не косметический фикс для tests only.

Это исправление реального runtime gap:
- до фикса browser response truth-case застревал на `page.open`;
- после фикса полный browser-flow truth-case проходит через real pipeline.

## Следствие для дальнейших изменений

Любые изменения вокруг browser session state теперь нужно проверять как минимум в двух слоях:
- unit around `start-browser-session` / `page-open`;
- real `scenario.profile.real.test.mjs`.
