# A29.1d — scenario classification response

## Что добавлено
- `read-scenario-classification-response.cjs`
- `apply-scenario-classification-response.cjs`
- in-memory application of scenario classification response before `preflightScenarioPlan()`
- rerun preflight against the patched scenario registry
- execute scenario normally when response closes all unknown steps

## Поддержанные источники response
В `executableCtxSnapshot.runtime.scenario_command_registry`:
- `classification_response` — встроенный объект
- `classificationResponse` — встроенный объект
- `classification_response_path` — путь к YAML/JSON
- `classificationResponsePath` — путь к YAML/JSON
- `response_path` / `responsePath` — алиасы

## Текущий scope
В этой версии цикл доказан unit-тестом для unknown named command.
Browser-action update path также поддержан на уровне apply/match/request helper-ов.
