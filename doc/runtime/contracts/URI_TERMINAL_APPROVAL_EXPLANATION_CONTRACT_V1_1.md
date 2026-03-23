<!-- path: /doc/runtime/contracts/URI_TERMINAL_APPROVAL_EXPLANATION_CONTRACT_V1_1.md -->

# URI TERMINAL APPROVAL + EXPLANATION CONTRACT v1.1

Статус: draft v1.1  
Проект: uri-runner  
Дата: 2026-03-23

---

## 1. Цель

Зафиксировать дополнительный слой безопасности для terminal execution в URI Runner:

- обязательное объяснение от Макса перед подтверждаемыми terminal steps;
- обязательную проверку, можно ли заменить выбранную команду более безопасной альтернативой;
- единый watcher/prompt формат для действий со статусом `ask`;
- журналирование причины выбора команды и решения пользователя.

Этот документ не заменяет базовый terminal policy v1, а усиливает его.

---

## 2. Место в общей модели

Данный контракт расширяет уже зафиксированную модель:

1. compile request / task
2. materialize execution plan
3. classify terminal step by policy
4. decide `auto` / `ask` / `deny`
5. **если `ask`: выполнить explanation + safer-alternative review**
6. показать watcher / approval prompt
7. получить решение пользователя
8. выполнить step или пометить его как denied
9. записать trace / history / outbox

---

## 3. Главная идея

### 3.1. Explanation — это не просто заметка

Объяснение перед подтверждаемой командой нужно не только для пользователя.
Оно является обязательным шагом мышления Макса.

Перед тем как предложить risky или non-auto команду, Макс обязан:

- сформулировать цель;
- объяснить, почему выбрана именно эта команда;
- зафиксировать, почему требуется подтверждение;
- указать ожидаемый результат;
- проверить, существует ли существенно более безопасная альтернатива.

Это уменьшает вероятность импульсивного, слишком широкого или разрушительного решения.

### 3.2. Safer alternative review

Если команду можно заменить более безопасной, более узкой или более локальной командой без потери цели,
Макс должен выбрать именно её.

Опасная команда не должна оставаться выбранной по умолчанию, если найден более безопасный рабочий вариант.

---

## 4. Когда контракт обязателен

Контракт v1.1 обязателен для каждого terminal step, у которого:

- `policyDecision = ask`, или
- step относится к группам `G2`–`G7`, или
- шаг затрагивает запись, project scripts, git mutation, dependency actions, network, DB, env, процессы, сервисы.

Для шагов `auto` этот слой не обязателен.

Для шагов `deny` выполнение не допускается, но причина deny должна оставаться в report/prompt.

---

## 5. Новые обязательные поля шага

Каждый terminal step со статусом `ask` должен иметь блоки `assistantRationale` и `saferAlternativeReview`.

### 5.1. Нормативный пример

```json
{
  "id": "step-03",
  "title": "Run project tests",
  "program": "npm",
  "args": ["test"],
  "cwd": "/workspace/project",
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
```

---

## 6. Требования к explanation

### 6.1. Обязательные поля explanation

URI обязан иметь и показать пользователю следующие поля:

- `goal`
- `whyThisCommand`
- `whyApprovalIsNeeded`
- `expectedOutcome`

### 6.2. Запрет пустых формулировок

Не допускаются объяснения вида:

- «запускаю команду»;
- «это нужно для проверки»;
- «команда выбрана для решения задачи»;
- любые формальные и пустые повторы без конкретики.

Объяснение считается валидным только если оно помогает ответить на вопросы:

- что именно хочет проверить или изменить Макс;
- почему выбрана именно эта команда, а не любая другая;
- где риск;
- что должно получиться в результате.

### 6.3. Требование конкретности

Explanation должно быть:

- узким;
- привязанным к цели текущего шага;
- без абстрактных формулировок;
- без сокрытия риска.

---

## 7. Требования к saferAlternativeReview

### 7.1. Обязательный шаг мышления

Перед каждым `ask` step Макс обязан проверить:

1. можно ли решить задачу read-only командой;
2. можно ли использовать более узкую команду вместо широкой;
3. можно ли использовать штатную project-команду вместо прямого разрушительного действия;
4. можно ли ограничить scope пути, цели, порта, процесса, ветки или сервиса.

### 7.2. Обязательные поля saferAlternativeReview

- `considered` — проверялся ли вопрос альтернатив;
- `foundSaferAlternative` — найдена ли безопасная альтернатива;
- `alternatives[]` — список альтернатив, если они есть;
- `selectedWhy` — почему выбрана текущая команда.

### 7.3. Нормативный пример с найденной альтернативой

```json
{
  "saferAlternativeReview": {
    "considered": true,
    "foundSaferAlternative": true,
    "alternatives": [
      {
        "commandPreview": "npm run clean",
        "whySafer": "использует штатный скрипт проекта вместо прямого удаления файлов",
        "tradeoff": "зависит от корректности package.json"
      }
    ],
    "selectedWhy": "Выбрана альтернатива npm run clean как более безопасный вариант"
  }
}
```

### 7.4. Правило выбора

Если найдена существенно более безопасная альтернатива, она должна быть выбрана по умолчанию.

Оставить более опасную команду можно только если в `selectedWhy` явно указано,
почему safer option не решает задачу или имеет неприемлемые ограничения.

---

## 8. Watcher / prompt формат

Перед выполнением `ask` step URI должен показать explanation-блок в watcher.

### 8.1. Нормативный watcher prompt

```text
URI WATCH
────────────────────────
status: awaiting approval
mode: strict_safe
step: 3/6
group: G2_SAFE_VALIDATION
decision: ask
risk: medium

goal:
Проверить, не сломали ли изменения текущий pipeline

selected command:
npm test

why this command:
Это штатная команда проекта для проверки unit/scenario тестов.

why approval is needed:
Команда запускает project scripts и может иметь побочные эффекты.

expected outcome:
Либо успешный проход тестов, либо диагностический вывод в outbox.

safer alternative review:
Более безопасная рабочая альтернатива не найдена.

approve:
[Y/Enter = yes] [N = no] [Q = abort]
```

### 8.2. Если safer alternative найдена

Watcher должен показать:

- что альтернатива была рассмотрена;
- что выбрано в итоге;
- почему.

Пример:

```text
safer alternative review:
Найдена более безопасная альтернатива: npm run clean
Выбрана именно она, так как она уже ограничена логикой проекта.
```

---

## 9. Правила подтверждения

### 9.1. Поддерживаемые ответы пользователя

- `Enter` → approve
- `y` / `Y` → approve
- `n` / `N` → deny current step
- `q` / `Q` → abort whole run

### 9.2. Семантика ответов

- `approve` — шаг выполняется;
- `deny` — шаг помечается как `denied_by_user`, run либо продолжается по policy, либо фиксирует остановку сценария;
- `abort` — весь run переводится в `aborted_by_user`.

`deny` и `abort` не должны смешиваться.

---

## 10. Журналирование

URI обязан сохранить explanation и saferAlternativeReview не только в watcher,
но и в артефактах run.

Минимум:

- `provided/terminal/approval-step-<id>.txt`
- `provided/terminal/terminal-result.json`
- `report.json`
- `history/trace` записи

### 10.1. Что должно попасть в report

Для каждого `ask` step:

- `group`
- `policyDecision`
- `riskLevel`
- `assistantRationale`
- `saferAlternativeReview`
- пользовательское решение: `approved` / `denied` / `aborted`
- итог шага: `succeeded` / `failed` / `denied_by_user` / `skipped`

---

## 11. Как это усиливает безопасность

Данный контракт усиливает безопасность четырьмя способами:

1. уменьшает blind approvals со стороны пользователя;
2. заставляет Макса явно осознавать риск перед risky step;
3. заставляет Макса проверять, нельзя ли заменить широкую команду более безопасной;
4. создаёт прозрачный audit trail того, что видел пользователь до выполнения.

Но важно:

- explanation не заменяет policy;
- saferAlternativeReview не заменяет sandbox;
- confirm не заменяет realpath boundary checks;
- snapshot/rollback не отменяют риск сети, секретов и системных действий.

---

## 12. Изменения относительно v1

Этот документ дополняет terminal policy v1 следующими требованиями:

- для `ask` steps explanation становится обязательным;
- поиск безопасной альтернативы становится обязательным шагом мышления;
- watcher должен показывать не только команду и risk, но и причину выбора;
- `Q` добавляется как явный abort whole run;
- explanation и saferAlternativeReview попадают в report/outbox.

---

## 13. Рекомендуемый ближайший порядок внедрения

1. добавить в terminal step schema поля `assistantRationale` и `saferAlternativeReview`;
2. валидировать их наличие для шагов `ask`;
3. обновить watcher prompt;
4. обновить обработку ответов `Enter/Y/N/Q`;
5. записывать explanation в trace/report/outbox;
6. после этого уже расширять project-specific allowlists.

---

## 14. Краткая формула документа

### URI Terminal Approval + Explanation Contract v1.1

- `auto` шаги идут без explanation;
- `ask` шаги обязаны иметь explanation;
- перед `ask` шагом Макс обязан проверить safer alternatives;
- если найдена более безопасная альтернатива, выбирать нужно её;
- watcher обязан показать цель, команду, причину выбора, причину confirm и ожидаемый результат;
- ответы пользователя: `Enter/Y = yes`, `N = no`, `Q = abort`;
- explanation и saferAlternativeReview журналируются в артефактах run.

