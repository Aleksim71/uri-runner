# A29.1a — scenario-command-registry spec

## Цель

Добавить **отдельный реестр для scenario-layer**, не смешивая его с audit terminal-command registry.

Основание по текущему коду проекта:

- `src/uram/run-plan.cjs` исполняет scenario-plan и различает:
  - шаги `kind: "command"` с `step.command` (`system.echo`, `project.*` и т.п.);
  - шаги `kind: "browser"` с `step.action` (`session.start`, `page.open`, `page.wait`, `diagnostics.collect`, `session.stop`).
- `src/commands/load-commands.cjs` загружает именованные команды как `<library>.<file>`.
- `src/commands/command-registry.cjs` уже умеет `has/resolve/assertAllowed` для named commands.
- `src/uram/compile-browser-flow.cjs` компилирует browser flow в шаги с именами:
  - `browser.session.start`
  - `browser.page.open`
  - `browser.page.wait`
  - `browser.diagnostics.collect`
  - `browser.session.stop`

## Принцип

A29.1a пока **не меняет runtime-код**, а фиксирует канонический контракт будущего реестра.

Нужны **две независимые секции**:

1. `named_commands` — для scenario step `kind: command`
2. `browser_actions` — для scenario step `kind: browser`

Почему так:
- `command` шаги в текущем коде маршрутизируются через command registry и реальные JS handlers;
- `browser` шаги исполняются отдельными ветками в `run-plan.cjs`, без command registry;
- значит, для browser нужен не `command`, а отдельный matcher по `action`.

## Канонический файл

```text
config/scenario-command-registry.yaml
```

## Структура файла

```yaml
version: 1

defaults:
  on_unknown: classification_required
  generate_request: true
  execute_unknown: false

named_commands:
  - id: system.echo
    group: system
    profile: instant
    match:
      command: system.echo
    args_schema:
      required: [message]

browser_actions:
  - id: browser.page.open
    group: browser
    profile: browser_navigation
    match:
      action: page.open
    args_schema:
      required: [url]
```

## Семантика defaults

- `on_unknown: classification_required`
  - если matcher не найден, scenario execution не стартует;
- `generate_request: true`
  - формируется `classification-request`;
- `execute_unknown: false`
  - неизвестный step не исполняется.

## named_commands

Используются для шагов вида:

```yaml
- kind: command
  command: system.echo
  args:
    message: hello
```

### Поля записи

- `id` — стабильный id записи реестра;
- `group` — смысловая группа (`system`, `project`, `approval`, `custom`);
- `profile` — runtime-profile (`instant`, `short_wait`, `stateful`, `approval`);
- `notes` — пояснение;
- `match.command` — точное имя команды;
- `args_schema.required` — список обязательных ключей в `args`;
- `args_schema.optional` — опциональные ключи;
- `policy.roots` — допустимые roots, если требуется отдельная политика;
- `classification_hint` — текстовая подсказка для classification-request.

### MVP-правило матчинга

Для A29.1a достаточно **точного match по `command`**.

## browser_actions

Используются для шагов вида:

```yaml
- kind: browser
  action: page.open
  args:
    url: https://example.com
```

### Поля записи

- `id`
- `group: browser`
- `profile`
- `notes`
- `match.action`
- `args_schema.required`
- `args_schema.optional`
- `classification_hint`

### Базовые действия по текущему коду

Подтверждённые browser actions:

- `session.start`
- `page.open`
- `page.wait`
- `diagnostics.collect`
- `diagnostics.run`
- `session.stop`

Примечание:
- `diagnostics.run` в `run-plan.cjs` обрабатывается как синоним `diagnostics.collect`.

## Scenario preflight result

### Успешный preflight

```yaml
status: ok
matched_named_commands: 1
matched_browser_actions: 2
unknown_steps: []
```

### Unknown step

```yaml
status: classification_required
unknown_steps:
  - source: steps[0]
    kind: command
    command: system.unknown
```

## Classification request

Формируется до execution, если найден неизвестный scenario-step.

### Для named command

```yaml
version: 1
status: classification_required
engine: scenario
unknown_steps:
  - source: steps[0]
    kind: command
    command: system.unknown
    args_keys: [message]
    suggested_match:
      command: system.unknown
```

### Для browser action

```yaml
version: 1
status: classification_required
engine: scenario
unknown_steps:
  - source: steps[1]
    kind: browser
    action: page.capture
    args_keys: [path]
    suggested_match:
      action: page.capture
```

## Classification response

Макс возвращает структурированный ответ, который можно применить к registry.

```yaml
version: 1
named_commands:
  - id: system.unknown
    group: system
    profile: instant
    match:
      command: system.unknown
    args_schema:
      required: [message]

browser_actions:
  - id: browser.page.capture
    group: browser
    profile: browser_artifact
    match:
      action: page.capture
    args_schema:
      required: [path]
```

## Решение для A29.1b

Следующий этап должен добавить только:

1. loader для `config/scenario-command-registry.yaml`;
2. preflight поверх normalized scenario-plan;
3. `classification_required` без исполнения неизвестных named commands / browser actions.

Ничего больше A29.1a не требует.
