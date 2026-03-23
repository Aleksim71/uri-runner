<!-- path: /doc/runtime/contracts/URI_TERMINAL_APPROVAL_WATCHER_PROMPT_V1.md -->

# URI_TERMINAL_APPROVAL_WATCHER_PROMPT_V1

Статус: draft v1  
Проект: uri-runner  
Дата: 2026-03-23

---

## 1. Цель

Зафиксировать точный протокол того,
как URI показывает в watcher/CLI шаг terminal approval,
какие поля обязан отобразить до подтверждения,
какие состояния watcher допустимы,
и какой пользовательский ввод должен приниматься в v1.

Этот документ не заменяет:

- `TERMINAL_INSPECT_CONTRACT_V1`
- `TERMINAL_EXEC_POLICY_V1`
- `URI_TERMINAL_APPROVAL_EXPLANATION_CONTRACT_V1_1`

Он определяет именно **UX-слой watcher prompt**
для step-level confirm в terminal execution.

---

## 2. Базовый принцип

Если step имеет `policyDecision = ask`,
URI **не имеет права** выполнять его сразу.

До исполнения URI обязан:

1. перевести watcher в состояние `awaiting_approval`;
2. показать понятный approval prompt;
3. отобразить rationale от Макса;
4. отобразить причину, почему нужен confirm;
5. дождаться пользовательского решения;
6. зафиксировать это решение в runtime result / trace / outbox.

---

## 3. Scope v1

В v1 поддерживается только текстовый watcher/CLI prompt.

Входит в контракт:

- step-level approval prompt;
- обязательные блоки сообщения;
- short status transitions;
- базовые ответы пользователя;
- минимальные правила нормализации ввода;
- обязательная фиксация решения.

Не входит в v1:

- mouse/UI-кнопки;
- TUI-таблицы;
- multi-select;
- editing команды перед исполнением;
- повторное редактирование rationale;
- rich terminal widgets;
- одновременное ожидание нескольких approval.

---

## 4. Состояния watcher

Для approval flow watcher должен поддерживать минимум следующие состояния:

### `planned`
Plan построен, шаг ещё не исполняется.

### `awaiting_approval`
URI ждёт решения пользователя по конкретному step.

### `running`
Шаг подтверждён и исполняется.

### `denied_by_user`
Пользователь отклонил конкретный step.

### `aborted_by_user`
Пользователь остановил весь run.

### `completed`
Шаг или весь run завершён.

---

## 5. Когда prompt обязателен

Approval prompt обязателен для каждого step,
у которого materialized decision равен:

- `policyDecision = ask`

Prompt не показывается, если:

- `policyDecision = auto`
- `policyDecision = deny`

Для `deny` watcher должен показать сообщение о запрете,
но не переводить шаг в режим ожидания ввода.

---

## 6. Обязательные поля approval prompt

Перед подтверждением watcher обязан показать следующие смысловые поля.

### 6.1. Header

- режим исполнения, например `strict_safe`;
- текущий статус: `awaiting approval`;
- номер шага и общее число шагов;
- группа команды;
- уровень риска.

### 6.2. Goal

Краткая цель шага человеческим языком.

### 6.3. Selected command

Команда, выбранная для исполнения.

Показывать нужно:

- `program`
- `args`
- при необходимости `cwd`

### 6.4. Why this command

Краткое обоснование от Макса,
почему выбрана именно эта команда.

### 6.5. Why approval is needed

Обязательное объяснение,
почему шаг не был auto-разрешён policy.

### 6.6. Expected outcome

Что URI ожидает получить,
если команда выполнится успешно.

### 6.7. Safer alternatives

Если проводился review безопасных альтернатив,
watcher обязан показать одно из двух:

- `no safer practical alternative found`
- краткое описание найденной альтернативы и почему она выбрана / не выбрана

### 6.8. Input help

Watcher обязан явно показать,
какие клавиши доступны пользователю в v1.

---

## 7. Нормативный формат prompt

Рекомендуемый watcher prompt:

```text
URI WATCH
────────────────────────
mode: strict_safe
status: awaiting approval
step: 3/6
group: G2_SAFE_VALIDATION
risk: medium

goal:
Проверить, не сломан ли runtime pipeline после изменений

selected command:
npm test
cwd: /workspace/project

why this command:
Это штатная команда проекта для проверки unit/scenario тестов.
Она даёт самый прямой способ проверить текущую работоспособность.

why approval is needed:
Project script не входит в auto-safe набор,
так как может запускать дополнительные внутренние шаги.

expected outcome:
Либо тесты пройдут успешно, либо URI вернёт диагностический stdout/stderr.

safer alternatives:
No safer practical alternative found.

approve:
[Y/Enter = yes] [N = no] [Q = abort]
```

URI может незначительно менять форматирование,
но не должен выбрасывать обязательные смысловые поля.

---

## 8. Prompt для `policyDecision = deny`

Если шаг запрещён policy,
watcher должен показать deny-message без ожидания ввода.

Рекомендуемый формат:

```text
URI WATCH
────────────────────────
mode: strict_safe
status: command denied
step: 5/8
group: G8_FORBIDDEN_SYSTEM_COMMANDS
risk: high

goal:
Установить системный пакет

selected command:
sudo apt install tree

why denied:
System-level mutation is forbidden in current mode.
```

---

## 9. Контракт пользовательского ввода

В v1 принимаются следующие решения:

### Approve

Допустимые значения:

- `Enter`
- `y`
- `Y`

Нормализованное значение:

- `approve`

### Deny

Допустимые значения:

- `n`
- `N`

Нормализованное значение:

- `deny`

### Abort run

Допустимые значения:

- `q`
- `Q`

Нормализованное значение:

- `abort`

---

## 10. Правила чтения ввода

### 10.1. Пустой ввод

Пустой ввод через `Enter` считается `approve`.

### 10.2. Пробелы

Ведущие и хвостовые пробелы должны быть отброшены.

### 10.3. Регистр

Ввод должен обрабатываться без учёта регистра.

### 10.4. Неизвестное значение

Если введено неизвестное значение,
URI не должен исполнять step.

Он обязан:

1. показать краткое сообщение `unknown decision`;
2. повторно показать input help;
3. остаться в состоянии `awaiting_approval`.

---

## 11. Поведение после решения

### 11.1. Approve

Если решение = `approve`, URI обязан:

1. записать `userDecision = approve`;
2. перевести step в `running`;
3. начать исполнение шага;
4. после исполнения зафиксировать финальный status шага.

### 11.2. Deny

Если решение = `deny`, URI обязан:

1. записать `userDecision = deny`;
2. перевести step в `denied_by_user`;
3. не исполнять команду;
4. завершить run с user-blocked final status
   или по правилам сценария пометить остальные шаги как `skipped`.

### 11.3. Abort

Если решение = `abort`, URI обязан:

1. записать `userDecision = abort`;
2. перевести текущий step в `aborted_by_user`;
3. остановить весь run;
4. пометить оставшиеся шаги как `skipped`;
5. завершить run с final status `aborted_by_user`.

---

## 12. Что должно попасть в trace

Минимум должны фиксироваться:

- момент входа в `awaiting_approval`;
- текстовый approval summary или его structured equivalent;
- normalized user decision;
- timestamp решения;
- переход состояния step;
- final status шага;
- top-level final status run.

---

## 13. Что должно попасть в outbox/result

В terminal result должны попасть минимум:

- `policyDecision`;
- `approval.required`;
- `approval.reasonCode`;
- `approval.riskLevel`;
- `assistantRationale`;
- `saferAlternativeReview`;
- `userDecision`;
- `status` шага.

Если prompt был показан,
результат должен позволять восстановить,
какое именно решение принял пользователь.

---

## 14. Правило прозрачности

Approval prompt не должен быть формальностью.

Если step требует подтверждения,
watcher обязан показать **не только команду**,
но и её смысл:

- зачем она нужна;
- почему она не auto;
- что ожидается на выходе;
- можно ли было решить задачу безопаснее.

Это повышает безопасность не только для пользователя,
но и для самого Макса,
поскольку заставляет формулировать причину выбора шага до исполнения.

---

## 15. Минимальные implementation notes

Для первой реализации достаточно:

- одной функции render approval prompt;
- одной функции normalize user decision;
- одного enum для watcher states;
- одного детерминированного flow для `approve | deny | abort`.

Не нужно начинать с rich UI.

Сначала важнее:

- точная структура;
- повторяемость;
- понятный текст;
- корректная фиксация решения.

---

## 16. Open questions for next version

За пределами v1 остаются:

- hotkeys `S` / `D` для full details;
- просмотр полного command JSON;
- nested approval;
- batch approval;
- policy hints по типу `safer command suggested`;
- локализация prompt;
- TUI layout.

---

## 17. Итог

`URI_TERMINAL_APPROVAL_WATCHER_PROMPT_V1` фиксирует,
как именно URI должен показывать approval-шаг в watcher,
какие смысловые блоки он обязан вывести,
какой ввод пользователя принимается,
и как это решение должно повлиять на run.

Это даёт следующий практический слой после terminal inspect contract:

- policy уже классифицирует шаг;
- rationale уже подготовлено;
- watcher умеет прозрачно запросить confirm;
- решение пользователя становится частью formal runtime result.
