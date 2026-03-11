# URI Runner Next Runtime Pack

Содержимое архива:

- `src/commands/command-registry.cjs`
- `src/uram/scenario-parser.cjs`
- `src/uram/scenario-executor.cjs`
- `src/commands/system/echo.cjs`
- `test/scenarios/scenario-runtime.smoke.test.mjs`

## Назначение

Это минимальный working skeleton для Scenario Runtime v1:

- registry
- parser
- executor
- test command
- smoke test

## Ожидаемый smoke path

`scenario doc -> parseScenario -> executeScenario -> command registry -> command handler`

## Что поддержано

- `scenario.start`
- `steps[]`
- `step.id`
- `step.command`
- `step.args`
- `step.on_success`
- `step.on_failure`
- `step.stop`

## Что пока не включено

- `if`
- safe expression evaluator
- cycle analysis на parser-уровне
- auto-loader команд
