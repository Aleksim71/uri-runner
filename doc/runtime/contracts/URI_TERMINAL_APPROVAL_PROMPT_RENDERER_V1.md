# URI_TERMINAL_APPROVAL_PROMPT_RENDERER_V1

## Назначение

Документ фиксирует минимальный renderer для watcher,
который получает нормализованную approval view model
и превращает её в текстовый prompt для пользователя.

Этот слой следует после:

- terminal step contract
- approval view model

И до:

- чтения stdin
- ветвления approve / deny / abort
- запуска команды

## Цель слоя

Разделить:

- подготовку данных
- текстовый вывод watcher

Watcher не должен собирать строки из сырого step JSON.
Он должен получать готовую view model и рендерить её
через одну чистую функцию.

## Вход

Renderer принимает `viewModel` вида:

```json
{
  "state": "awaiting_approval",
  "stepId": "step-03",
  "title": "Run tests",
  "group": "G2_SAFE_VALIDATION",
  "policyDecision": "ask",
  "riskLevel": "medium",
  "goal": "Проверить, не сломали ли изменения текущий пайплайн",
  "command": "npm test",
  "whyThisCommand": "npm test — штатная команда проекта для проверки тестов",
  "whyApprovalIsNeeded": "Project scripts могут иметь побочные эффекты",
  "expectedOutcome": "Либо зелёный тестовый прогон, либо диагностический вывод",
  "saferAlternativeSummary": "Более безопасной альтернативы не найдено"
}
```

## Выход

Функция возвращает watcher-friendly текст:

```text
URI WATCH
────────────────────────
status: awaiting_approval
step: step-03
title: Run tests
group: G2_SAFE_VALIDATION
decision: ask
risk: medium

goal:
Проверить, не сломали ли изменения текущий пайплайн

selected command:
npm test

why this command:
npm test — штатная команда проекта для проверки тестов

why approval is needed:
Project scripts могут иметь побочные эффекты

expected result:
Либо зелёный тестовый прогон, либо диагностический вывод

safer alternatives:
Более безопасной альтернативы не найдено

approve:
[Y/Enter = yes] [N = no] [Q = abort]
```

## Правила рендера

- пустые секции не выводятся
- footer с confirm options выводится всегда
- status по умолчанию: `awaiting_approval`
- renderer не читает stdin
- renderer не принимает решение за пользователя
- renderer не запускает команды

## Что не входит в этот слой

Этот слой пока не делает:

- normalize input
- approve / deny / abort branch
- watcher state transitions
- trace / outbox запись
- execution wiring

Это только presentation layer для approval prompt.
