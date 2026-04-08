# docs/runtime/a32-v2-release-gate.md

# A32 — URI Runner v2 release gate

## Назначение
Этот документ фиксирует минимальный release gate для рабочего режима `uri-runner-next`.
Цель — убрать расплывчатое состояние «почти готово» и заменить его простым правилом: 
что именно обязано быть подтверждено перед merge, release и регулярным рабочим использованием.

## Базовый принцип
URI Runner считается пригодным к регулярной работе только тогда, когда:
1. подтверждён базовый unit/integration слой;
2. подтверждён scenario truth layer;
3. browser/runtime изменения не проходят без real watcher validation;
4. source of truth не противоречит docs/runtime.

## Обязательные проверки

### 1. Базовый тестовый слой
Обязательно зелёный:

```bash
npm test
```

Ожидание на момент A31 sync:
- общий тестовый слой зелёный;
- критических падений нет.

### 2. Canonical scenario truth gate
Обязательно зелёный:

```bash
npx vitest run test/real/scenario.profile.real.test.mjs
```

Этот запуск является canonical truth gate для scenario-слоя.

### 3. Обязательный real rerun для чувствительных зон
Если изменения касаются хотя бы одной из зон ниже, одного unit-слоя недостаточно:
- `scenario` runtime;
- `classification_required` / `classification_response`;
- `scenario-command-registry`;
- browser-flow;
- watcher pipeline;
- browser session/page state.

Для таких изменений обязательно повторно запускать:

```bash
npx vitest run test/real/scenario.profile.real.test.mjs
```

## Блокирующие regressions
Ниже перечислены regressions, после которых состояние считается неготовым к release/merge.

### Scenario / classification
Блокирует release, если нарушено хотя бы одно:
- `unknown_named` больше не даёт `classification_required`;
- `classification_response` больше не применяется и не приводит к rerun/execute;
- успешный named scenario case больше не проходит;
- inline путь `runtime.scenario_command_registry.classification_response` перестал подтверждаться.

### Browser-flow / runtime state
Блокирует release, если нарушено хотя бы одно:
- `unknown_browser_action` больше не даёт `classification_required`;
- browser classification response больше не приводит к успешному выполнению;
- после `browser.session.start` без attach не создаётся fallback `runtime.page`;
- `browser.page.open` снова падает с `BROWSER_PAGE_INSTANCE_MISSING`.

### Docs / truth drift
Блокирует release, если нарушено хотя бы одно:
- docs/runtime не отражают текущий source of truth;
- canonical truth gate не зафиксирован явно;
- browser runtime changes считаются подтверждёнными только unit-тестами.

## Минимальный pre-release набор команд

```bash
cd /home/aleksim/uri-runner-next && \
  git st && \
  git log --oneline --decorate -n 12 && \
  npm test && \
  npx vitest run test/real/scenario.profile.real.test.mjs
```

## Правило принятия решения
Считать состояние готовым к регулярной работе можно только если одновременно верны все пункты:
1. `npm test` зелёный;
2. `test/real/scenario.profile.real.test.mjs` зелёный;
3. чувствительные runtime/browser/scenario изменения переподтверждены real truth test;
4. docs/runtime не расходятся с фактическим source of truth.

## Статус после A31 sync
На момент A31 sync release gate опирается на уже подтверждённые факты:
- полный цикл `preflight -> classification_required -> classification-response -> rerun -> execute` подтверждён;
- `test/real/scenario.profile.real.test.mjs` зелёный (`5/5`);
- общий тестовый слой зелёный;
- browser runtime fallback page adapter уже признан обязательным для no-endpoint `session.start` path.
