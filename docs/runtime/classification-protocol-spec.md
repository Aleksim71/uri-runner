# docs/runtime/classification-protocol-spec.md

## Назначение

Этот документ задаёт канонический протокол цикла:

`scenario -> preflight -> classification-request? -> classification-response -> registry update -> preflight -> execution`

Протокол нужен, чтобы:
- безопасно останавливать неизвестные команды до выполнения;
- пополнять реестр команд контролируемо;
- сделать поведение URI предсказуемым и тестируемым.

## Фаза 1. Scenario input

URI получает сценарий, содержащий шаги.

Минимально для terminal/audit-команды у шага должны быть доступны:
- `cmd`
- `args`
- `cwd` или проектный контекст
- `receiver: uri`

## Фаза 2. Preflight

`preflight` — это разбор сценария без фактического запуска команд.

Во время `preflight` URI должен:
1. извлечь все команды из сценария;
2. попытаться сопоставить каждую команду с `command-registry`;
3. сформировать список:
   - `known_commands`
   - `unknown_commands`
4. определить итоговый статус preflight.

### Допустимые статусы preflight

#### `ready_to_execute`
Все команды сценария сопоставлены с реестром.

#### `classification_required`
Есть хотя бы одна неизвестная команда. Сценарий не должен исполняться.

#### `invalid_scenario`
Сценарий невалиден структурно и не может быть обработан.

## Фаза 3. Classification request

Если preflight вернул `classification_required`, URI должен:
- не выполнять ни один шаг сценария;
- сформировать структурированный `classification-request`;
- вернуть этот файл в outbox.

### Требования

1. В одном запросе должны собираться все неизвестные команды сценария сразу.
2. Запрос должен быть структурированным, без необходимости разбирать свободный текст.
3. Запрос должен содержать достаточно контекста, чтобы Макс мог принять решение без повторного запуска сценария.

### Поля `classification-request`

Обязательные поля:
- `version`
- `status: classification_required`
- `scenario_id`
- `generated_at`
- `unknown_commands[]`

Каждый элемент `unknown_commands[]` должен содержать:
- `step_id`
- `cmd`
- `args`
- `cwd`
- `project`
- `fingerprint`
- `raw_step`

Рекомендуемые поля:
- `suggested_group`
- `suggested_profile`
- `notes`

## Фаза 4. Classification response

`classification-response` — это структурированный ответ Макса, который URI может применить без догадок.

### Требования

1. Ответ должен быть машинно-читаемым.
2. Ответ должен задавать matcher, группу и профиль.
3. Ответ может содержать timeouts/readiness/risk.
4. Ответ не должен требовать свободной интерпретации URI.

### Поля `classification-response`

Обязательные поля:
- `version`
- `scenario_id`
- `classifications[]`

Каждый элемент `classifications[]` должен содержать:
- `fingerprint`
- `group`
- `profile`
- `match`

Рекомендуемые поля:
- `notes`
- `timeouts`
- `readiness`
- `risk`

## Фаза 5. Registry update

После получения `classification-response` URI должен:
1. провалидировать ответ;
2. применить изменения к `config/command-registry.yaml`;
3. сохранить обновлённый реестр;
4. повторить `preflight` для исходного сценария.

Если после обновления реестра остаются неизвестные команды, URI снова должен вернуть `classification_required`.

## Фаза 6. Execution

Execution разрешён только если `preflight.status == ready_to_execute`.

Во время исполнения каждая команда уже использует профиль из реестра.

## Канонические файлы MVP

- `config/command-registry.yaml`
- `outbox/classification-request.yaml`
- `inbox/classification-response.yaml`
- `outbox/preflight-result.yaml`

## Канонические статусы верхнего уровня

Минимально:
- `ready_to_execute`
- `classification_required`
- `invalid_scenario`
- `executed`
- `failed`

## Принципы безопасности

1. Unknown command -> no execution.
2. One scenario -> one preflight.
3. One preflight can return many unknown commands.
4. Registry update must be explicit.
5. Execution only after successful re-check.

## Truth-критерии для A28.1a

Минимум нужны 3 truth-сценария:

1. **Known-only scenario**
   - preflight возвращает `ready_to_execute`;
   - execution проходит.

2. **Unknown command scenario**
   - preflight возвращает `classification_required`;
   - execution не стартует;
   - outbox содержит `classification-request`.

3. **Classified and re-run scenario**
   - после `classification-response` реестр обновляется;
   - повторный preflight возвращает `ready_to_execute`;
   - execution стартует.
