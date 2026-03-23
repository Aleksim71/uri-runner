# URI_TERMINAL_APPROVAL_FLOW_V1

## Исправление шага 6

Этот пакет самодостаточен и включает зависимости шага 6:

- normalize approval input
- approval view model
- approval prompt renderer
- approval flow orchestrator

## Причина исправления

Предыдущий пакет шага 6 зависел от файлов,
которые уже должны были быть добавлены на предыдущих шагах.
Если эти файлы ещё не были распакованы в проект,
тест падал с `Cannot find module`.

## Что делать

Распаковать этот архив поверх проекта.
Он содержит полный минимальный набор файлов,
который нужен для теста `create-approval-flow-state`.

## Состав

- `src/runtime/terminal/normalize-approval-input.cjs`
- `src/runtime/terminal/build-approval-view-model.cjs`
- `src/runtime/terminal/render-approval-prompt.cjs`
- `src/runtime/terminal/create-approval-flow-state.cjs`
- `test/unit/create-approval-flow-state.test.mjs`

## Важно

Это не новый архитектурный шаг.
Это корректирующий self-contained пакет для уже согласованного шага 6.
