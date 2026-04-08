# A29 — scenario layer notes

## Что подтверждено inspection-пакетом

1. `src/uram/run-plan.cjs`
   - scenario-plan исполняется здесь;
   - для `step.kind === "command"` используется `commands[step.command]`;
   - для `step.kind === "browser"` используется ветвление по `step.action`.

2. `src/commands/load-commands.cjs`
   - команды загружаются из library/file как `<library>.<file>`;
   - это естественная база для `named_commands`.

3. `src/commands/command-registry.cjs`
   - уже существует registry с `register/has/list/assertAllowed/resolve`;
   - значит, новый scenario registry не должен дублировать runtime registry 1-в-1;
   - он должен быть **preflight registry**, а не executor registry.

4. `src/uram/compile-browser-flow.cjs`
   - browser flow уже имеет явный ограниченный набор действий;
   - это хорошая база для `browser_actions` registry.

## Решение A29.1a

Не переносить audit-registry как есть.

Сделать отдельный файл:

- `config/scenario-command-registry.yaml`

И отдельный трек:

- preflight для `kind: command`
- preflight для `kind: browser`
- единый `classification-request` для unknown scenario steps
