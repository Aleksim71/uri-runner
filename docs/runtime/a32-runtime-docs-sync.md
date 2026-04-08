# docs/runtime/a32-runtime-docs-sync.md

# A32 — runtime docs sync / source-of-truth notes

## Назначение
Этот документ закрепляет, что именно нужно считать source of truth для scenario/browser runtime слоя,
и что должно быть отражено в docs tree / runtime index после A31 sync.

## Канонические утверждения

### 1. Scenario source of truth
Для scenario-слоя source of truth состоит из двух частей:
- focused unit / helper tests;
- обязательный real truth gate: `test/real/scenario.profile.real.test.mjs`.

Важно: scenario-слой нельзя считать подтверждённым только по unit-тестам.

### 2. Browser runtime validation rule
Для browser runtime изменений одного unit-слоя недостаточно.
Нужно подтверждение через real watcher pipeline.

### 3. Canonical truth gate
Файл

```text
test/real/scenario.profile.real.test.mjs
```

должен быть явно отмечен в docs/runtime и связанных индексах как:
- canonical truth gate;
- обязательная проверка для scenario/classification/browser-flow изменений.

## Что именно подтверждено после A31 sync

### Named scenario truth layer
Подтверждены cases:
1. `scenario.success.basic`
2. `scenario.classification_required.unknown_named`
3. `scenario.classification_response.applies_and_executes`

### Browser-flow truth layer
Подтверждены cases:
4. `scenario.classification_required.unknown_browser_action`
5. `scenario.classification_response.browser_applies_and_executes`

## Важные engineering notes, которые нельзя терять в docs

### 1. Browser-flow classification shape
Часть шагов в browser-flow classification request приходит как `command-shaped`, а не как `kind: browser`.
Это должно быть отмечено в docs/runtime как особенность preflight/classification слоя.

### 2. Inline response path
Для real/watch response-case надёжно подтверждён inline путь:

```text
runtime.scenario_command_registry.classification_response
```

Это нужно сохранить как важную инженерную заметку в runtime docs.

### 3. Browser fallback page adapter
После A30.2a browser runtime считает обязательным следующее правило:
- `browser.session.start` без attach должен создавать fallback `runtime.page`;
- иначе `browser.page.open` может упасть с `BROWSER_PAGE_INSTANCE_MISSING`.

Этот fix должен быть явно связан с:
- `src/runtime/browser/start-browser-session.cjs`;
- `test/unit/start-browser-session.fallback-page-adapter.test.cjs`.

## Что должно быть связано в runtime docs tree
После sync логично считать связанными следующие документы:
- `docs/runtime/a30-scenario-truth-layer-notes.md`
- `docs/runtime/a30-browser-runtime-state-fix-notes.md`
- `docs/runtime/a31-scenario-truth-source-of-truth.md`
- `docs/runtime/a32-v2-release-gate.md`
- `docs/runtime/a32-runtime-docs-sync.md`

## Минимальный текст для runtime index / tree
Ниже текст, который можно использовать как каноническую формулировку в индексе:

> Scenario source of truth = focused unit/helper tests + mandatory real gate `test/real/scenario.profile.real.test.mjs`.
> Browser runtime changes are not considered confirmed by unit tests alone; real watcher pipeline confirmation is required.
> Browser-flow classification may appear in command-shaped form.
> Fallback `runtime.page` creation after `browser.session.start` is mandatory for the no-endpoint path.

## Операционный смысл sync
После A31/A32 docs tree должен говорить не просто «есть тесты», а именно:
- какой тест является каноническим;
- для каких зон он обязателен;
- какие regressions считаются блокирующими;
- какие runtime/browser особенности нельзя потерять при следующих циклах hardening.
