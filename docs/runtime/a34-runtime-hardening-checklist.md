# docs/runtime/a34-runtime-hardening-checklist.md

# A34 — runtime hardening checklist

## Назначение
Этот документ фиксирует короткий рабочий список добивки runtime-хвостов после A31/A33.
Его задача — не расширять scope проекта, а закрыть уже выявленные зоны,
которые мешают считать URI Runner полностью стабилизированным для регулярной работы.

## Источник списка
Текущий hardening scope берётся из подтверждённого A31-состояния и ограничивается тремя направлениями:
1. унификация path-based `classification_response`;
2. более явная browser-flow state model;
3. более ясная документация вокруг command-shaped browser-flow preflight.

## Правило работы с этим checklist
- Каждый пункт должен закрываться через код + подтверждение тестами + обновление docs/runtime.
- Пункты ниже считаются stabilizing work, а не новой функциональностью.
- Если изменение затрагивает scenario / classification / browser-flow runtime, после него обязателен canonical real truth gate.

---

## Блок A — classification_response path unification

### Цель
Сделать так, чтобы `classification_response` обрабатывался предсказуемо и одинаково,
без разъезда между разными путями представления одного и того же намерения.

### Что нужно проверить
- одинаково ли трактуются inline и path-based формы `classification_response`;
- нет ли мест, где response применяется только в одном shape, а второй silently drift-ит;
- нет ли расхождения между preflight-слоем, runtime-слоем и watcher-response path.

### Минимальный done-критерий
Пункт можно считать закрытым, когда одновременно верны все условия:
1. есть один канонический способ интерпретации `classification_response`;
2. альтернативные формы либо нормализуются в канонический вид, либо явно отклоняются;
3. это поведение отражено в docs/runtime простым текстом;
4. real truth test не показывает regression в apply-and-execute цикле.

### Блокирующие симптомы
- response применяется для одного shape, но не применяется для другого;
- rerun происходит не всегда;
- статус/результат выглядит успешным, хотя response фактически не применился;
- source of truth в docs не объясняет, какой shape считается каноническим.

---

## Блок B — browser-flow state model hardening

### Цель
Сделать browser runtime state model более явной и предсказуемой,
чтобы переходы состояния не зависели от неявных допущений.

### Что уже важно не потерять
После A30.2a обязательным считается правило:
- `browser.session.start` без attach должен создавать fallback `runtime.page`;
- иначе `browser.page.open` может снова прийти к `BROWSER_PAGE_INSTANCE_MISSING`.

### Что нужно проверить
- где именно создаётся и хранится browser session state;
- какие поля/адаптеры обязательны до `page.open`;
- какие состояния считаются валидными после `session.start`;
- нет ли скрытого различия между endpoint-path и no-endpoint-path.

### Минимальный done-критерий
Пункт можно считать закрытым, когда одновременно верны все условия:
1. browser-flow state model описана в терминах явных состояний/ожиданий;
2. no-endpoint path и attach/endpoint path не расходятся по критическому поведению без явного объяснения;
3. fallback `runtime.page` зафиксирован как обязательная часть контракта для нужного path;
4. unit + real truth слой подтверждают отсутствие regressions.

### Блокирующие симптомы
- `page.open` зависит от неявного объекта, который может не появиться;
- разные пути старта сессии ведут к разным неописанным состояниям;
- browser-flow проходит unit-слой, но ломается в real watcher pipeline;
- docs/runtime не объясняют минимальный валидный browser state.

---

## Блок C — command-shaped browser-flow preflight docs

### Цель
Ясно закрепить в документации особенность, что часть browser-flow classification/preflight запросов приходит в command-shaped виде,
а не как буквальный `kind: browser`.

### Что нужно проверить
- отражено ли это в runtime docs и index;
- не делают ли следующие циклы разработки неверное предположение,
  будто browser-flow всегда приходит в одном shape;
- понятно ли из документации, как это влияет на classification_required и response apply path.

### Минимальный done-критерий
Пункт можно считать закрытым, когда одновременно верны все условия:
1. в docs/runtime есть короткое и прямое описание command-shaped browser-flow особенностей;
2. рядом указано, почему это важно для preflight/classification слоя;
3. ссылка на canonical truth gate добавлена в тот же контекст;
4. engineering note не потеряется при следующем docs sync.

### Блокирующие симптомы
- разработчик по docs ожидает только `kind: browser` и ломает preflight;
- command-shaped path перестаёт учитываться как часть browser-flow truth;
- docs и фактическое поведение снова расходятся.

---

## Общий done-критерий для A34 hardening
A34 hardening checklist можно считать практически закрытым, когда:
1. по каждому из трёх блоков есть либо кодовое закрытие, либо явное правило нормализации/контракта;
2. `npm test` зелёный;
3. `test/real/scenario.profile.real.test.mjs` зелёный;
4. docs/runtime обновлены и не противоречат release gate / runtime contract.

## Минимальный прогон после каждого чувствительного изменения

```bash
cd /home/aleksim/uri-runner-next && \
  git st && \
  git diff --stat && \
  npm test && \
  npx vitest run test/real/scenario.profile.real.test.mjs
```

## Практический смысл
Этот checklist нужен для того, чтобы оставшиеся хвосты добивались не хаотично,
а как короткая stabilizing-программа:
- сначала привести к единому виду `classification_response`;
- затем стабилизировать browser runtime state model;
- затем закрепить knowledge в docs/runtime так, чтобы следующий цикл не откатил понимание назад.
