<!-- path: doc/runtime/A19_URI_Mitya_Start_Prompt.md -->

# A19 — Browser Diagnostics / DevTools Attach v1

## Назначение

Этот документ — стартовый рабочий prompt для URI / Мити на реализацию **A19.1** в проекте `uri-runner`.

Контекст:
- **A18 завершён**: terminal approval + execution/report flow закрыт, watcher стабилизирован.
- Следующий слой — **browser diagnostics / DevTools attach** как новый runtime layer поверх уже существующей архитектуры.

---

## PROJECT

- Проект: `uri-runner`
- Ветка: `feat/runtime-safety`
- Этап: **A19.1 Browser Diagnostics / DevTools Attach v1**

---

## GOAL

Добавить в `uri-runner` первый безопасный browser diagnostics layer.

URI должен уметь:
1. подключаться к **разрешённой diagnostic session** браузера;
2. собирать **минимальный безопасный набор browser artifacts**;
3. нормализовать результат;
4. записывать артефакты в контролируемую sandbox-область;
5. подготавливать результат для включения в `outbox.zip`.

Важно:
- речь идёт **не о GUI-управлении DevTools**, а о работе с **диагностическим интерфейсом браузера**;
- это должен быть **новый runtime layer**, а не ad-hoc код внутри terminal-модулей.

---

## ARCHITECTURAL RULES

Удержать уже подтверждённый архитектурный принцип A18:

1. approval / policy  
2. raw browser diagnostics collection  
3. result normalization  
4. artifact writing  
5. trace / outbox / history integration  

Нельзя смешивать:
- approval и raw diagnostics;
- raw collection и artifact writing;
- attach logic и prompt rendering.

Также удержать принцип:
- **browser failure != fatal watcher failure**, если нет отдельного `config_error`-класса причины.

---

## SAFE SCOPE FOR A19.1

В первой рабочей итерации реализовать только безопасный и узкий слой.

### Разрешённый сценарий

- пользователь **вручную** подготовил браузер и нужную страницу;
- URI подключается только к **разрешённой** диагностической сессии;
- URI собирает только безопасные контрактные артефакты;
- URI не обязан управлять GUI браузера.

### Минимальный набор A19.1

Собрать минимум:
- `page-metadata.json`
- `screenshot.png`
- `console.json`
- `errors.json`
- `browser-report.json`

---

## NON-GOALS FOR A19.1

В A19.1 **не реализовывать**:
- cookies;
- `localStorage` / `sessionStorage` / `IndexedDB`;
- request body / response body;
- auth headers;
- произвольный JS в контексте страницы;
- подключение к обычному пользовательскому browser profile;
- использование браузера как обхода приватной пользовательской сессии;
- полный GUI control DevTools;
- auto-launch браузера как обязательную часть первого этапа.

Это всё оставить вне safe scope.

---

## IMPLEMENTATION TARGETS

Создать новый browser runtime layer.

### 1. Runtime modules

Создать файлы:
- `src/runtime/browser/attach-browser-session.cjs`
- `src/runtime/browser/collect-browser-artifacts.cjs`
- `src/runtime/browser/normalize-browser-result.cjs`
- `src/runtime/browser/write-browser-artifacts.cjs`

### 2. Approval / policy modules

Создать минимальный policy-каркас:
- `src/runtime/browser/normalize-browser-approval-input.cjs`
- `src/runtime/browser/build-browser-approval-view-model.cjs`
- `src/runtime/browser/render-browser-approval-prompt.cjs`
- `src/runtime/browser/handle-browser-step-policy.cjs`

### 3. Contracts

Создать документы:
- `doc/runtime/contracts/browser-approval-explanation.md`
- `doc/runtime/contracts/browser-approval-prompt.md`
- `doc/runtime/contracts/browser-attach-sequence.md`
- `doc/runtime/contracts/browser-artifacts-contract.md`

### 4. Tests

Добавить тесты:
- `test/unit/attach-browser-session.test.mjs`
- `test/unit/collect-browser-artifacts.test.mjs`
- `test/unit/normalize-browser-result.test.mjs`
- `test/unit/write-browser-artifacts.test.mjs`
- `test/scenarios/browser-flow.diagnostics-report.test.mjs`

---

## MODULE CONTRACTS

### `attach-browser-session.cjs`

Задача:
- attach к разрешённой diagnostic session;
- выбрать target page по безопасному `targetHint`;
- вернуть attach-result;
- ничего не писать на диск;
- не собирать артефакты.

Ожидаемый смысл результата:
- `status: ok | failed`
- `session` с `endpoint`, `targetId`, `targetUrl`, `targetTitle`, `browserType`
- `warnings`
- `error`

### `collect-browser-artifacts.cjs`

Задача:
- взять готовый attach-result;
- собрать минимальный safe-набор A19.1;
- не писать файлы на диск;
- вернуть сырые browser artifacts в нормализуемом виде.

### `normalize-browser-result.cjs`

Задача:
- собрать attach-result + collect-result в единый `browser-diagnostics` result;
- сформировать `browser-report.json`;
- вернуть единый `status: ok | warning | failed`;
- подготовить структуру под artifact writer.

### `write-browser-artifacts.cjs`

Задача:
- записать нормализованные browser artifacts в sandbox;
- вернуть manifest и paths;
- не принимать policy-решения;
- не выполнять attach и collect.

### `handle-browser-step-policy.cjs`

Для A19.1 правила должны быть такими:
- attach + metadata + screenshot + console + errors → обычно `allow`
- reload / open URL / browser launch / trace → `confirm`
- cookies / storage / headers / body / user profile / arbitrary JS → `deny`

---

## ACCEPTANCE CRITERIA

A19.1 считается выполненным, если:

1. browser approval/policy path отделён от raw diagnostics collection;
2. URI умеет attach к разрешённой browser diagnostic session;
3. URI умеет собрать минимум:
   - `page-metadata.json`
   - `screenshot.png`
   - `console.json`
   - `errors.json`
   - `browser-report.json`
4. URI пишет browser artifacts в sandbox;
5. есть unit tests для attach / collect / normalize / write;
6. есть scenario test:
   - `browser prepared manually -> URI attached -> artifacts returned`
7. SAFE / CONFIRM / FORBIDDEN границы зафиксированы в `doc/runtime/contracts/`;
8. browser failure не валит watcher фатально, если это не отдельный конфигурационный сбой.

---

## PRACTICAL ORDER OF WORK

Делать в таком порядке:

### Commit 1
`docs(browser): add A19 browser diagnostics v1 contracts`

Содержимое:
- все browser contracts в `doc/runtime/contracts/`

### Commit 2
`feat(browser): add diagnostic session attach adapter`

Содержимое:
- `attach-browser-session.cjs`
- unit test для attach

### Commit 3
`feat(browser): collect minimal diagnostics artifacts`

Содержимое:
- `collect-browser-artifacts.cjs`
- `normalize-browser-result.cjs`
- unit tests

### Commit 4
`feat(browser): write artifacts and add diagnostics scenario`

Содержимое:
- `write-browser-artifacts.cjs`
- scenario test
- wiring into runtime artifact flow

---

## CONSTRAINTS

Соблюдать дополнительные ограничения:
- не ломать существующий terminal flow A18;
- не тащить browser logic в `src/runtime/terminal/*`;
- не смешивать safe A19.1 с A19.2/A19.3 задачами;
- не добавлять широкий browser automation scope под видом diagnostics;
- не добавлять forbidden/private-state доступ даже "временно".

---

## EXPECTED OUTPUT FROM URI / MITIA

Нужно вернуть:

1. список созданных/изменённых файлов;
2. краткое объяснение архитектуры нового browser layer;
3. результаты тестов;
4. описание scenario coverage;
5. список того, что **сознательно не вошло** в A19.1;
6. готовый `inbox.zip` / runner-пакет для переноса поверх проекта.

Не включать в пакет локальный шум и runtime-state, если он не часть фичи.

---

## SHORT TASK FORMULATION

Реализуй **A19.1 Browser Diagnostics / DevTools Attach v1** для `uri-runner` как новый безопасный runtime layer поверх A18.

Нужен первый рабочий сценарий:

**manual prep -> attach -> metadata/screenshot/console/errors -> browser-report -> sandbox artifacts -> scenario tests**

С обязательным удержанием архитектурного правила:

**approval/policy -> raw diagnostics -> normalization -> artifact writing**

и с сохранением safe browser boundaries.
