<!-- path: /doc/runtime/contracts/TERMINAL_INSPECT_CONTRACT_V1.md -->

# TERMINAL_INSPECT_CONTRACT_V1

Статус: draft v1.1  
Проект: uri-runner  
Дата: 2026-03-23

---

## 1. Цель

Определить точный контракт входа и выхода для безопасного терминального режима
`terminal.inspect.v1`.

Этот контракт отвечает на вопросы:

- как Макс формулирует терминальный запрос к URI;
- в каком формате URI материализует terminal plan;
- какой результат URI обязан вернуть;
- как фиксируются успех, ошибка, policy reject, timeout и артефакты вывода;
- как оформляются approval-step, explanation и safer-alternative review.

Контракт должен работать совместно с `TERMINAL_EXEC_POLICY_V1`,
контрактом approval/explanation v1.1 и существующим runtime pipeline URI.

---

## 2. Базовый принцип

`terminal.inspect.v1` — это не raw shell.

URI принимает **структурированный terminal request**,
превращает его в **структурированный terminal plan**,
проверяет plan и policy,
при необходимости подготавливает approval prompt,
выполняет шаги в sandbox/container,
возвращает **формализованный terminal result**.

---

## 3. Место в pipeline

Терминальный pipeline должен выглядеть так:

1. compile terminal request
2. materialize terminal plan
3. validate terminal plan schema
4. validate against terminal exec policy
5. **для шагов `ask`: validate explanation + safer-alternative review**
6. execute in sandbox/container
7. normalize execution result
8. finalize
9. write outbox / trace / history

Терминальный контракт не должен обходить существующий runtime.

---

## 4. Scope v1

В v1 поддерживается только безопасный inspect-режим.

Разрешено:

- читать состояние проекта;
- запускать inspection-команды;
- запускать тесты и проверочные команды;
- возвращать stdout/stderr;
- прикладывать большие выводы как артефакты;
- выполнять шаги последовательно;
- показывать **нормализованный approval prompt** для шагов `ask`.

Не входит в v1:

- raw shell session;
- произвольная интерактивная работа в shell;
- background jobs;
- unrestricted network;
- unrestricted DB access;
- параллельное выполнение шагов.

Примечание:
интерактивный prompt подтверждения допустим,
но только как часть policy-controlled execution,
а не как общий interactive shell mode.

---

## 5. Термины

### Terminal request
Входной объект, описывающий, что нужно выполнить.

### Terminal plan
Материализованный и валидированный набор terminal steps,
подготовленный к исполнению.

### Terminal step
Один исполняемый шаг с `program`, `args`, `cwd`, `profile`.

### Approval step
Шаг, у которого `policyDecision = ask` и который требует подтверждения пользователя.

### Assistant rationale
Структурированное объяснение от Макса,
почему выбрана именно эта команда и что она должна дать.

### Safer alternative review
Структурированная проверка,
можно ли заменить выбранную команду более безопасной альтернативой.

### Terminal result
Итог выполнения пакета terminal steps.

### Step result
Результат одного terminal step.

### Artifact
Файл, приложенный в outbox, например полный stdout/stderr или approval prompt snapshot.

---

## 6. Terminal request contract (input)

Нормативный формат входа:

```json
{
  "version": 1,
  "kind": "terminal.inspect",
  "goal": "Проверить состояние git и прогнать тесты",
  "projectRoot": "/workspace/project",
  "steps": [
    {
      "id": "step-01",
      "title": "Git status short",
      "profile": "git.inspect",
      "program": "git",
      "args": ["status", "--short"],
      "cwd": "/workspace/project",
      "timeoutMs": 20000
    },
    {
      "id": "step-02",
      "title": "Run tests",
      "profile": "node.test",
      "program": "npm",
      "args": ["test"],
      "cwd": "/workspace/project",
      "timeoutMs": 120000
    }
  ]
}
```

### Обязательные поля верхнего уровня

- `version`
- `kind`
- `goal`
- `projectRoot`
- `steps`

### Обязательные поля шага

- `id`
- `profile`
- `program`
- `args`
- `cwd`

### Опциональные поля шага

- `title`
- `timeoutMs`
- `envAllowlist`
- `outputMode`
- `stdoutMaxBytes`
- `stderrMaxBytes`

Примечание:
поля explanation/policy не обязательно задавать во входном request.
Они могут быть материализованы позже во время compile/materialize.

---

## 7. Input constraints

### Верхний уровень

- `version` в v1 должен быть равен `1`
- `kind` в v1 должен быть равен `"terminal.inspect"`
- `goal` — непустая строка
- `projectRoot` — допустимый путь внутри sandbox workspace
- `steps` — непустой массив

### Ограничения на steps

- минимум 1 шаг
- максимум рекомендуется ограничить, например, 20 шагами
- `id` шага должен быть уникальным внутри request
- шаги исполняются строго последовательно
- каждый шаг должен быть self-contained

### Ограничения формата

- `program` — строка без shell wrapping
- `args` — массив строк
- нельзя передавать raw shell line как шаг
- нельзя передавать `bash -lc`, `sh -c` и аналогичные wrappers
- `cwd` должен быть внутри разрешённого workspace

---

## 8. Materialized terminal plan contract

После compile/materialize URI должен получить terminal plan следующего типа:

```json
{
  "version": 1,
  "kind": "terminal.inspect.plan",
  "goal": "Проверить состояние git и прогнать тесты",
  "projectRoot": "/workspace/project",
  "executionMode": "sequential",
  "sandbox": {
    "mode": "container",
    "network": "off",
    "projectMount": "readonly",
    "tmpWritable": true,
    "outboxWritable": true
  },
  "steps": [
    {
      "id": "step-01",
      "title": "Git status short",
      "profile": "git.inspect",
      "mode": "inspect",
      "program": "git",
      "args": ["status", "--short"],
      "cwd": "/workspace/project",
      "timeoutMs": 20000,
      "stdoutMaxBytes": 65536,
      "stderrMaxBytes": 65536,
      "group": "G0_SAFE_READ_ONLY",
      "policyDecision": "auto"
    },
    {
      "id": "step-02",
      "title": "Run tests",
      "profile": "node.test",
      "mode": "inspect",
      "program": "npm",
      "args": ["test"],
      "cwd": "/workspace/project",
      "timeoutMs": 120000,
      "stdoutMaxBytes": 65536,
      "stderrMaxBytes": 65536,
      "group": "G2_SAFE_VALIDATION",
      "policyDecision": "ask",
      "approval": {
        "required": true,
        "reasonCode": "PROJECT_SCRIPT_MAY_HAVE_SIDE_EFFECTS",
        "riskLevel": "medium"
      },
      "assistantRationale": {
        "goal": "Проверить, не сломали ли изменения текущий pipeline",
        "whyThisCommand": "npm test — штатная команда проекта для проверки unit/scenario тестов",
        "whyApprovalIsNeeded": "Команда запускает project scripts и может иметь побочные эффекты",
        "expectedOutcome": "Либо все тесты пройдут, либо URI вернёт stdout/stderr и код падения"
      },
      "saferAlternativeReview": {
        "considered": true,
        "foundSaferAlternative": false,
        "selectedWhy": "Штатной более узкой команды для этой цели в проекте не найдено"
      }
    }
  ]
}
```

### Обязательные поля terminal plan

- `version`
- `kind`
- `goal`
- `projectRoot`
- `executionMode`
- `sandbox`
- `steps`

### Обязательные поля sandbox

- `mode`
- `network`
- `projectMount`
- `tmpWritable`
- `outboxWritable`

### Обязательные поля materialized step

- `id`
- `profile`
- `program`
- `args`
- `cwd`
- `group`
- `policyDecision`

### Дополнительные обязательные поля для `ask` step

- `approval.required`
- `approval.reasonCode`
- `approval.riskLevel`
- `assistantRationale.goal`
- `assistantRationale.whyThisCommand`
- `assistantRationale.whyApprovalIsNeeded`
- `assistantRationale.expectedOutcome`
- `saferAlternativeReview.considered`
- `saferAlternativeReview.foundSaferAlternative`
- `saferAlternativeReview.selectedWhy`

### Требования к plan

- каждый шаг уже должен быть нормализован;
- defaults должны быть материализованы явно;
- не должно оставаться неоднозначных интерпретаций;
- policy checker должен работать именно по materialized plan;
- approval-step не должен оставаться без explanation и safer-alternative review.

---

## 9. Validation rules

Terminal request / plan отклоняется, если:

- `version` не поддерживается;
- `kind` не поддерживается;
- отсутствуют обязательные поля;
- `steps` пуст;
- есть дубли `step.id`;
- `program` пустой;
- `args` не массив строк;
- `cwd` вне разрешённого workspace;
- `profile` не разрешён;
- `timeoutMs` вне допустимого диапазона;
- нарушены ограничения `TERMINAL_EXEC_POLICY_V1`.

### Дополнительные validation rules для approval-step

Plan также отклоняется, если у шага `policyDecision = ask`:

- отсутствует `approval`;
- отсутствует `assistantRationale`;
- отсутствует `saferAlternativeReview`;
- отсутствует любой обязательный explanation field;
- `riskLevel` не входит в допустимый набор (`low`, `medium`, `high`);
- explanation формально пустой или повторяет только название команды;
- `saferAlternativeReview.considered` не равен `true`.

Рекомендуется использовать отдельный structural error code,
например `TERMINAL_APPROVAL_EXPLANATION_INVALID`.

---

## 10. Step execution contract

Каждый step выполняется как изолированная операция.

Для каждого шага должны быть определены:

- `id`
- `profile`
- `program`
- `args`
- `cwd`
- `timeoutMs`
- output limits
- sandbox context
- policy metadata

### Правила исполнения v1

- шаги идут последовательно;
- следующий шаг начинается только после завершения предыдущего;
- общий скрытый shell-state между шагами запрещён;
- `cd` не живёт между шагами как внешнее состояние;
- произвольный интерактивный stdin запрещён;
- background processes запрещены;
- для `ask` step сначала показывается approval prompt,
  и только после `approve` начинается execution.

---

## 11. Step result contract (output per step)

Нормативный формат результата одного шага:

```json
{
  "id": "step-02",
  "title": "Run tests",
  "profile": "node.test",
  "program": "npm",
  "args": ["test"],
  "cwd": "/workspace/project",
  "group": "G2_SAFE_VALIDATION",
  "policyDecision": "ask",
  "startedAt": "2026-03-23T10:00:00.000Z",
  "finishedAt": "2026-03-23T10:00:20.350Z",
  "durationMs": 20350,
  "exitCode": 0,
  "status": "success",
  "userDecision": "approved",
  "stdoutPreview": "All tests passed",
  "stderrPreview": "",
  "stdoutBytes": 28,
  "stderrBytes": 0,
  "stdoutTruncated": false,
  "stderrTruncated": false,
  "assistantRationale": {
    "goal": "Проверить, не сломали ли изменения текущий pipeline",
    "whyThisCommand": "npm test — штатная команда проекта для проверки unit/scenario тестов",
    "whyApprovalIsNeeded": "Команда запускает project scripts и может иметь побочные эффекты",
    "expectedOutcome": "Либо все тесты пройдут, либо URI вернёт stdout/stderr и код падения"
  },
  "saferAlternativeReview": {
    "considered": true,
    "foundSaferAlternative": false,
    "selectedWhy": "Штатной более узкой команды для этой цели в проекте не найдено"
  },
  "artifacts": [
    "provided/terminal/approval-step-02.txt"
  ]
}
```

### Обязательные поля step result

- `id`
- `profile`
- `program`
- `args`
- `cwd`
- `group`
- `policyDecision`
- `startedAt`
- `finishedAt`
- `durationMs`
- `status`

### Рекомендуемые поля

- `title`
- `exitCode`
- `userDecision`
- `stdoutPreview`
- `stderrPreview`
- `stdoutBytes`
- `stderrBytes`
- `stdoutTruncated`
- `stderrTruncated`
- `assistantRationale`
- `saferAlternativeReview`
- `artifacts`
- `error`

### Допустимые `status`

- `success`
- `failed`
- `timeout`
- `policy_rejected`
- `sandbox_error`
- `skipped`
- `denied_by_user`
- `aborted_by_user`

---

## 12. Step error contract

Если шаг завершился неуспешно, должен присутствовать объект `error`:

```json
{
  "code": "TERMINAL_TIMEOUT",
  "message": "Step exceeded timeout limit",
  "details": {
    "timeoutMs": 20000
  }
}
```

### Обязательные поля error

- `code`
- `message`

### Опциональные поля error

- `details`

---

## 13. Terminal result contract (top-level output)

Нормативный формат итогового terminal result:

```json
{
  "version": 1,
  "kind": "terminal.inspect.result",
  "goal": "Проверить состояние git и прогнать тесты",
  "projectRoot": "/workspace/project",
  "ok": true,
  "finalStatus": "success",
  "startedAt": "2026-03-23T10:00:00.000Z",
  "finishedAt": "2026-03-23T10:02:10.000Z",
  "durationMs": 130000,
  "executionMode": "sequential",
  "sandbox": {
    "mode": "container",
    "network": "off",
    "projectMount": "readonly"
  },
  "summary": {
    "totalSteps": 2,
    "successSteps": 2,
    "failedSteps": 0,
    "timeoutSteps": 0,
    "policyRejectedSteps": 0,
    "sandboxErrorSteps": 0,
    "skippedSteps": 0,
    "approvedSteps": 1,
    "deniedSteps": 0,
    "abortedSteps": 0
  },
  "steps": [
    {
      "id": "step-01",
      "status": "success"
    },
    {
      "id": "step-02",
      "status": "success",
      "userDecision": "approved"
    }
  ],
  "artifacts": [
    "provided/terminal/terminal-result.json",
    "provided/terminal/approval-step-02.txt"
  ],
  "error": null
}
```

### Обязательные поля top-level result

- `version`
- `kind`
- `goal`
- `projectRoot`
- `ok`
- `finalStatus`
- `startedAt`
- `finishedAt`
- `durationMs`
- `executionMode`
- `summary`
- `steps`

### Рекомендуемые поля

- `sandbox`
- `artifacts`
- `error`

---

## 14. Final status semantics

### Допустимые `finalStatus`

- `success`
- `failed`
- `policy_rejected`
- `sandbox_error`
- `blocked_by_user`
- `aborted_by_user`

### Правила

#### `success`
Используется, если:
- plan валиден,
- policy пропустила все шаги,
- все шаги завершились со `status=success`.

#### `policy_rejected`
Используется, если:
- хотя бы один шаг отклонён policy до исполнения.

#### `sandbox_error`
Используется, если:
- среда выполнения не смогла корректно исполнить plan.

#### `blocked_by_user`
Используется, если:
- approval-step был показан,
- пользователь выбрал deny для шага,
- run не продолжился дальше.

#### `aborted_by_user`
Используется, если:
- пользователь явно прервал весь run через abort action.

#### `failed`
Используется, если:
- plan был допущен,
- sandbox работал,
- но хотя бы один шаг завершился `failed` или `timeout`.

Частичный успех как отдельный final status не вводится.

---

## 15. Output preview and artifact rules

Большой stdout/stderr не должен безлимитно встраиваться в JSON-result.

Правила:

- в result хранится только preview ограниченного размера;
- полный вывод при необходимости сохраняется в artifact;
- artifact прикладывается в outbox;
- step result обязан сослаться на artifact через `artifacts`.

### Рекомендуемые артефакты

- `provided/terminal/step-01.stdout.txt`
- `provided/terminal/step-01.stderr.txt`
- `provided/terminal/approval-step-02.txt`

### Preview rules

- `stdoutPreview` и `stderrPreview` должны быть безопасно усечены;
- признак усечения фиксируется через `stdoutTruncated` / `stderrTruncated`.

### Approval artifact rules

Для каждого `ask` step рекомендуется сохранять:

- точный approval prompt, который видел пользователь;
- explanation snapshot;
- safer-alternative summary;
- итоговое решение пользователя.

---

## 16. Skipped steps rules

Если pipeline останавливается после ошибки, policy reject, deny или abort,
последующие шаги должны быть помечены как `skipped`.

Пример:

- `step-01` → `denied_by_user`
- `step-02` → `skipped`
- `step-03` → `skipped`

Это нужно для точной диагностики.

---

## 17. Suggested error codes

Рекомендуемый набор кодов:

- `TERMINAL_REQUEST_INVALID`
- `TERMINAL_PLAN_INVALID`
- `TERMINAL_POLICY_REJECTED`
- `TERMINAL_PROFILE_NOT_ALLOWED`
- `TERMINAL_PROGRAM_NOT_ALLOWED`
- `TERMINAL_ARGUMENTS_REJECTED`
- `TERMINAL_CWD_NOT_ALLOWED`
- `TERMINAL_TIMEOUT`
- `TERMINAL_OUTPUT_LIMIT_EXCEEDED`
- `TERMINAL_SANDBOX_ERROR`
- `TERMINAL_EXECUTION_FAILED`
- `TERMINAL_APPROVAL_EXPLANATION_INVALID`
- `TERMINAL_STEP_DENIED_BY_USER`
- `TERMINAL_RUN_ABORTED_BY_USER`

---

## 18. Trace contract

В trace должны попадать минимум следующие факты:

- terminal request metadata
- materialized terminal plan
- policy decision per step
- sandbox mode
- start / finish per step
- step status
- truncation facts
- top-level final status
- attached artifacts
- user decision for approval-step
- explanation snapshot for approval-step
- saferAlternativeReview for approval-step

Trace не обязан дублировать полный stdout/stderr,
если они уже вынесены в отдельные артефакты.

---

## 19. Outbox contract

В outbox должны попадать:

- terminal result summary;
- step-level statuses;
- приложенные stdout/stderr artifacts при необходимости;
- `terminal-result.json`;
- approval prompt snapshots для ask-step при необходимости.

Рекомендуемые артефакты outbox:

- `provided/terminal/terminal-result.json`
- `provided/terminal/step-01.stdout.txt`
- `provided/terminal/step-01.stderr.txt`
- `provided/terminal/approval-step-02.txt`

---

## 20. History contract

History entry для terminal.inspect должен хранить минимум:

- `goal`
- `finalStatus`
- `ok`
- `stepsCount`
- `startedAt`
- `finishedAt`
- `durationMs`
- путь к trace
- путь к terminal result artifact, если он сохранён
- approved / denied / aborted counters

---

## 21. Minimal normative examples

### Пример A. Полный успех

Request:
```json
{
  "version": 1,
  "kind": "terminal.inspect",
  "goal": "Проверить git status",
  "projectRoot": "/workspace/project",
  "steps": [
    {
      "id": "step-01",
      "profile": "git.inspect",
      "program": "git",
      "args": ["status", "--short"],
      "cwd": "/workspace/project"
    }
  ]
}
```

Result:
```json
{
  "version": 1,
  "kind": "terminal.inspect.result",
  "goal": "Проверить git status",
  "projectRoot": "/workspace/project",
  "ok": true,
  "finalStatus": "success",
  "summary": {
    "totalSteps": 1,
    "successSteps": 1,
    "failedSteps": 0,
    "timeoutSteps": 0,
    "policyRejectedSteps": 0,
    "sandboxErrorSteps": 0,
    "skippedSteps": 0,
    "approvedSteps": 0,
    "deniedSteps": 0,
    "abortedSteps": 0
  },
  "steps": [
    {
      "id": "step-01",
      "status": "success"
    }
  ]
}
```

### Пример B. Policy reject

Result:
```json
{
  "version": 1,
  "kind": "terminal.inspect.result",
  "goal": "Попытка опасной команды",
  "projectRoot": "/workspace/project",
  "ok": false,
  "finalStatus": "policy_rejected",
  "summary": {
    "totalSteps": 2,
    "successSteps": 0,
    "failedSteps": 0,
    "timeoutSteps": 0,
    "policyRejectedSteps": 1,
    "sandboxErrorSteps": 0,
    "skippedSteps": 1,
    "approvedSteps": 0,
    "deniedSteps": 0,
    "abortedSteps": 0
  },
  "steps": [
    {
      "id": "step-01",
      "status": "policy_rejected",
      "error": {
        "code": "TERMINAL_PROGRAM_NOT_ALLOWED",
        "message": "Program is not allowed for inspect mode"
      }
    },
    {
      "id": "step-02",
      "status": "skipped"
    }
  ]
}
```

### Пример C. Deny by user

Result:
```json
{
  "version": 1,
  "kind": "terminal.inspect.result",
  "goal": "Прогнать тесты",
  "projectRoot": "/workspace/project",
  "ok": false,
  "finalStatus": "blocked_by_user",
  "summary": {
    "totalSteps": 2,
    "successSteps": 0,
    "failedSteps": 0,
    "timeoutSteps": 0,
    "policyRejectedSteps": 0,
    "sandboxErrorSteps": 0,
    "skippedSteps": 1,
    "approvedSteps": 0,
    "deniedSteps": 1,
    "abortedSteps": 0
  },
  "steps": [
    {
      "id": "step-01",
      "status": "denied_by_user",
      "userDecision": "denied"
    },
    {
      "id": "step-02",
      "status": "skipped"
    }
  ]
}
```

---

## 22. Compatibility with TERMINAL_EXEC_POLICY_V1

Этот контракт не заменяет `TERMINAL_EXEC_POLICY_V1`, а использует его.

Распределение ответственности:

- `TERMINAL_INSPECT_CONTRACT_V1` — точный вход/выход и структура данных
- `TERMINAL_EXEC_POLICY_V1` — правила допуска, ограничения и безопасность исполнения
- `URI_TERMINAL_APPROVAL_EXPLANATION_CONTRACT_V1_1` — требования к explanation, safer alternatives и approval UX

Все три контракта должны применяться совместно.

---

## 23. Recommended implementation notes

Для практической реализации текущего шага рекомендуется:

- валидировать request и plan отдельно;
- явно материализовать defaults;
- хранить короткий preview в JSON;
- длинный вывод выносить в txt artifacts;
- остановку после policy reject / deny / abort делать детерминированно;
- приводить все step results к единой нормализованной форме;
- не допускать approval-step без explanation metadata.

---

## 24. Open questions for next contracts

За пределами этого контракта остаются:

- `terminal.mutate.v1`
- профили для readonly DB adapter
- безопасная поддержка pipe-like workflows
- опциональная параллельность шагов
- redaction secrets
- network-enabled terminal contracts
