# A28.1c — audit command registry preflight

## Что реально подключено этим пакетом

Подключён **точный preflight для audit-engine**, потому что именно audit-runbook уже оперирует реальными терминальными командами:

- `audit.checks[].cmd / args`
- `audit.server.cmd / args`

Это соответствует текущему формату `config/command-registry.yaml`.

## Что происходит

Если включён `runtime.command_registry.enabled: true`, то перед запуском audit-команд URI:

1. читает `RUNBOOK.yaml`;
2. извлекает terminal-команды из `audit.checks` и `audit.server`;
3. сверяет их с `config/command-registry.yaml`;
4. если находятся неизвестные команды, **ничего не исполняет**;
5. возвращает `classification_required`;
6. прикладывает request-артефакты:
   - `REPORT/classification-request.yaml`
   - `REPORT/classification-request.json`

## Как включить

Через executable context проекта:

```yaml
runtime:
  command_registry:
    enabled: true
    path: /absolute/path/to/config/command-registry.yaml
```

## Почему сделано opt-in

Текущий стартовый `command-registry.yaml` ещё маленький и не покрывает все существующие real/audit cases проекта. Поэтому глобальное принудительное включение сломало бы текущие truth-прогоны.

Сначала:
- включаем на отдельных сценариях/проектах,
- пополняем реестр,
- потом можно делать режим по умолчанию.

## Что пока не подключено

`scenario`-engine с именованными командами (`system.*`, `project.*`, `browser.*`) в этот пакет специально не трогался, потому что его текущий контракт отличается от terminal-registry.
