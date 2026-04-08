# A35 — URI capabilities matrix and real-test map

## Цель
Зафиксировать рабочую матрицу возможностей URI-runner по состоянию после A31 sync:
- какие группы возможностей уже подтверждены;
- какой тестовый слой считается опорным;
- какие real/truth проверки уже есть;
- где есть пробелы;
- что считать done для каждой группы.

Основа этого документа:
- закрытые циклы A28 / A29 / A30.1 / A30.2 / A30.2a;
- canonical truth gate `test/real/scenario.profile.real.test.mjs`;
- требование real watcher pipeline для browser runtime изменений.

---

## Статусы

- **GREEN** — возможность подтверждена текущим truth/real слоем.
- **YELLOW** — возможность частично подтверждена, но карта/контракт ещё не оформлены полностью.
- **RED** — возможность как группа ещё не закреплена отдельным real/truth пакетом.

---

## Матрица возможностей

| Группа | Что входит | Текущий статус | Текущее подтверждение | Опорные тесты / доказательства | Чего не хватает |
|---|---|---:|---|---|---|
| Scenario / named commands | preflight, classification_required, classification-response, rerun, execute для named scenario commands | GREEN | Полный цикл подтверждён | `test/real/scenario.profile.real.test.mjs` cases: `scenario.success.basic`, `scenario.classification_required.unknown_named`, `scenario.classification_response.applies_and_executes` | Только удерживать как canonical truth gate |
| Scenario / browser-flow | browser-action preflight, classification_required для browser action, classification-response apply, execute | GREEN | Browser-flow truth cases подтверждены | `test/real/scenario.profile.real.test.mjs` cases: `scenario.classification_required.unknown_browser_action`, `scenario.classification_response.browser_applies_and_executes` | Яснее зафиксировать command-shaped browser preflight |
| Browser runtime state | session.start, fallback page adapter, page.open runtime state | YELLOW | Реальный runtime-дефект найден и исправлен | fix в `src/runtime/browser/start-browser-session.cjs`, unit test `test/unit/start-browser-session.fallback-page-adapter.test.cjs`, плюс browser scenario truth coverage | Явнее оформить browser-flow state model и отдельный runtime contract section |
| Watcher pipeline | intake → preflight/classification → execute → artifacts/outbox | YELLOW | В документах подтверждён real/truth coverage через watcher pipeline | A28 notes, source-of-truth note, scenario real layer | Нужен отдельный короткий real-test map именно по watcher group |
| Classification registry | scenario-command-registry, preflight named/browser, classification-response apply | GREEN | Базовый контур подтверждён | A29 + A30.x state, inline path `runtime.scenario_command_registry.classification_response` | Унификация path-based `classification_response` |
| Outbox / result artifacts | возврат результата запуска в project-owned / outbox-контур | YELLOW | Контур используется и подразумевается контрактом | runtime docs sync + runtime contract docs | Нужен отдельный минимальный artifact contract с success/failure payload |
| Policy / permission layer | allow/deny roots, execution restrictions, controlled execution | YELLOW | Слой концептуально есть и соответствует controlled runner модели | ранее добавленные policy/hardening docs; текущий контракт раннера | Нужна отдельная capability карта с real-coverage привязкой |
| Terminal / system commands | системные / shell-подобные команды в контролируемом режиме | RED | Как группа не закреплена отдельной truth-картой в текущем A31 пакете | косвенно через общий controlled runner contract | Нужен отдельный grouped real test pack и эталон результатов |

---

## Canonical truth сегодня

### 1) Scenario truth gate
Для scenario-слоя каноническим truth gate считать:

- `test/real/scenario.profile.real.test.mjs`

### 2) Что именно он уже подтверждает
Этот real test уже покрывает:

1. `scenario.success.basic`
2. `scenario.classification_required.unknown_named`
3. `scenario.classification_response.applies_and_executes`
4. `scenario.classification_required.unknown_browser_action`
5. `scenario.classification_response.browser_applies_and_executes`

### 3) Browser runtime особое правило
Для browser runtime изменений одного unit-слоя недостаточно.  
Изменение считается подтверждённым только если оно не ломает real watcher/scenario truth path.

---

## Пробелы, которые ещё нужно закрыть

### 1) Watcher как отдельная capability group
Нужно отдельным коротким документом и/или тест-картой отметить:
- какие watcher paths считаются canonical;
- какие watcher regressions блокируют merge;
- какие артефакты обязаны появляться после прогонки.

### 2) Terminal/system group
Нужно оформить отдельную группу:
- какие terminal/system команды URI уже должен уметь выполнять;
- какой real test считается эталонным;
- какой outbox/result ожидается на success/failure.

### 3) Artifact contract
Нужно отдельно закрепить:
- минимальный `outbox` / `result` payload;
- что обязательно сохраняется при success;
- что обязательно сохраняется при failure;
- какие поля обязательны для сравнения с эталоном.

### 4) Policy group map
Нужно связать:
- capability group;
- policy restriction;
- expected allow/deny behavior;
- соответствующий real или focused test.

---

## Приоритет добивки

### P1 — закрепить группы, которые уже почти готовы
1. Watcher pipeline map
2. Artifact contract
3. Terminal/system capability group

### P2 — закрепить эксплуатационную управляемость
4. Policy / permission capability map
5. Browser-flow state model note

---

## Предлагаемая структура следующих grouped real tests

### Group A — Scenario
Уже есть:
- `test/real/scenario.profile.real.test.mjs`

Статус:
- **canonical**

### Group B — Watcher
Нужно добавить:
- минимум 1 real test на полный intake → execute → outbox cycle;
- минимум 1 regression case на classification_required path;
- минимум 1 case на failure artifact preservation.

### Group C — Terminal / system
Нужно добавить:
- 1 happy-path real test;
- 1 blocked/needs-classification case;
- 1 expected-artifacts comparison case.

### Group D — Browser runtime
Нужно удерживать:
- scenario browser-flow truth;
- unit/focused state tests;
- regression case для fallback page path.

### Group E — Policy
Нужно добавить:
- allow case;
- deny case;
- mixed profile case;
- expected error/result normalization.

---

## Done-критерий для матрицы возможностей

Матрица считается доведённой до рабочего состояния, когда для каждой активной группы есть:

1. краткое описание группы;
2. canonical test или набор тестов;
3. список блокирующих regressions;
4. expected result / artifacts;
5. ссылка на source-of-truth документ.

---

## Короткий вывод

По состоянию после A31:
- **Scenario** уже имеет рабочий canonical truth gate.
- **Browser-flow** подтверждён через scenario truth path.
- **Watcher / outbox / terminal / policy** как отдельные capability groups ещё нужно формально разложить и закрепить.

То есть основа URI уже рабочая, а текущая задача A35 — превратить это в явную карту возможностей, чтобы готовность измерялась не “на ощущении”, а по группам и по canonical real tests.
