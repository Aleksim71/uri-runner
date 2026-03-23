<!-- path: doc/runtime/A19-browser-diagnostics-v1-implementation.md -->

# A19 — Browser Diagnostics / DevTools Attach v1: implementation plan

## Статус

Этот документ фиксирует стартовую практическую рамку для A19.

A18 уже закрыт, поэтому новый слой строится **поверх** завершённого terminal approval + execution/report flow, а не вместо него.

---

## Цель A19.1

Добавить в `uri-runner` первый безопасный browser diagnostics layer.

URI должен уметь:

1. подключаться к **разрешённой** diagnostic session браузера;
2. собирать минимальный safe-набор browser artifacts;
3. нормализовать результат;
4. писать артефакты в sandbox;
5. подготавливать результат для включения в `outbox.zip`.

Важно:
речь идёт **не о GUI-управлении DevTools**, а о работе с диагностическим интерфейсом браузера.

---

## Архитектурный каркас

A19 повторяет архитектурную лестницу A18:

1. approval / policy
2. raw browser diagnostics collection
3. result normalization
4. artifact writing
5. trace / outbox / history integration

Нельзя смешивать:

- approval и raw collection;
- raw collection и artifact writing;
- attach logic и confirm-rendering.

Также удерживается правило:

**browser failure != fatal watcher failure**, если нет отдельного `config_error`.

---

## Scope A19.1

Разрешённый первый сценарий:

- пользователь вручную подготовил браузер и нужную страницу;
- URI подключается только к разрешённой diagnostic session;
- URI собирает только безопасные контрактные артефакты;
- URI не обязан управлять GUI браузера.

### Обязательный минимум A19.1

- `page-metadata.json`
- `screenshot.png`
- `console.json`
- `errors.json`
- `browser-report.json`

---

## Non-goals A19.1

Не входят в первую итерацию:

- cookies;
- `localStorage` / `sessionStorage` / `IndexedDB`;
- request body / response body;
- auth headers;
- arbitrary JS evaluation;
- attach к обычному пользовательскому browser profile;
- обход уже авторизованной пользовательской сессии;
- полный GUI control DevTools;
- auto-launch браузера как обязательный первый этап.

---

## Целевые файлы

### Runtime modules

Создать:

- `src/runtime/browser/attach-browser-session.cjs`
- `src/runtime/browser/collect-browser-artifacts.cjs`
- `src/runtime/browser/normalize-browser-result.cjs`
- `src/runtime/browser/write-browser-artifacts.cjs`

### Approval / policy modules

Создать минимальный каркас:

- `src/runtime/browser/normalize-browser-approval-input.cjs`
- `src/runtime/browser/build-browser-approval-view-model.cjs`
- `src/runtime/browser/render-browser-approval-prompt.cjs`
- `src/runtime/browser/handle-browser-step-policy.cjs`

### Documentation contracts

Создать:

- `doc/runtime/contracts/browser-approval-explanation.md`
- `doc/runtime/contracts/browser-approval-prompt.md`
- `doc/runtime/contracts/browser-attach-sequence.md`
- `doc/runtime/contracts/browser-artifacts-contract.md`

### Tests

Добавить:

- `test/unit/attach-browser-session.test.mjs`
- `test/unit/collect-browser-artifacts.test.mjs`
- `test/unit/normalize-browser-result.test.mjs`
- `test/unit/write-browser-artifacts.test.mjs`
- `test/scenarios/browser-flow.diagnostics-report.test.mjs`

---

## Порядок коммитов

### Commit 1
`docs(browser): add A19 browser diagnostics v1 contracts`

Содержимое:
- browser contracts в `doc/runtime/contracts/`

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

## Acceptance criteria

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

## Практический порядок реализации

Кодить в таком порядке:

1. `attach-browser-session.cjs`
2. `collect-browser-artifacts.cjs`
3. `normalize-browser-result.cjs`
4. `write-browser-artifacts.cjs`
5. `handle-browser-step-policy.cjs`
6. затем `normalize/build/render` для browser approval UI

---

## Короткий итог

Первый рабочий сценарий A19.1:

**manual prep → attach → metadata/screenshot/console/errors → browser-report → sandbox artifacts → scenario tests**
