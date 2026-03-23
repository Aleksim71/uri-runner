<!-- path: doc/runtime/A19-piligrim-block.md -->

# A19 Piligrim block

Ниже блок, который можно вставить в актуальный Piligrim после открытия новой фичи.

---

## A19 — Browser Diagnostics / DevTools Attach v1

### Статус

- A18 завершён и не является текущей незакрытой задачей
- новый целевой слой: **A19 Browser Diagnostics / DevTools Attach v1**
- текущий фокус: безопасный browser diagnostics layer поверх A18

### Цель

Дать URI возможность работать с DevTools **через диагностический интерфейс браузера**, а не через GUI-автоматизацию.

Практический результат:
- attach к разрешённой browser diagnostic session;
- сбор safe browser artifacts;
- нормализация результата;
- запись в sandbox;
- подготовка к `outbox.zip`.

### Scope A19.1

Первый рабочий сценарий:

- пользователь вручную подготовил браузер и страницу;
- URI attach-ится к разрешённой diagnostic session;
- URI собирает минимум:
  - `page-metadata.json`
  - `screenshot.png`
  - `console.json`
  - `errors.json`
  - `browser-report.json`

### Non-goals A19.1

Не входят:
- cookies;
- storage;
- request/response bodies;
- auth headers;
- arbitrary JS;
- обычный пользовательский browser profile;
- полный GUI control DevTools;
- обязательный auto-launch браузера.

### Архитектурные правила

Удержать лестницу слоёв:

1. approval / policy
2. raw browser diagnostics collection
3. result normalization
4. artifact writing
5. trace / outbox / history integration

Также удержать принцип:

- browser failure != fatal watcher failure

### Целевые файлы

Документы:
- `doc/runtime/contracts/browser-approval-explanation.md`
- `doc/runtime/contracts/browser-approval-prompt.md`
- `doc/runtime/contracts/browser-attach-sequence.md`
- `doc/runtime/contracts/browser-artifacts-contract.md`

Реализация:
- `src/runtime/browser/attach-browser-session.cjs`
- `src/runtime/browser/collect-browser-artifacts.cjs`
- `src/runtime/browser/normalize-browser-result.cjs`
- `src/runtime/browser/write-browser-artifacts.cjs`

Approval / policy:
- `src/runtime/browser/normalize-browser-approval-input.cjs`
- `src/runtime/browser/build-browser-approval-view-model.cjs`
- `src/runtime/browser/render-browser-approval-prompt.cjs`
- `src/runtime/browser/handle-browser-step-policy.cjs`

Тесты:
- `test/unit/attach-browser-session.test.mjs`
- `test/unit/collect-browser-artifacts.test.mjs`
- `test/unit/normalize-browser-result.test.mjs`
- `test/unit/write-browser-artifacts.test.mjs`
- `test/scenarios/browser-flow.diagnostics-report.test.mjs`

### Acceptance

A19.1 считается закрытым, когда:
- attach работает;
- safe artifacts собираются;
- browser report пишется;
- scenario tests зелёные;
- watcher не падает фатально из-за browser failure.
