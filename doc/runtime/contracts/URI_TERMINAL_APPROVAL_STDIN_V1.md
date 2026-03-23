# URI_TERMINAL_APPROVAL_STDIN_V1

## Исправление шага 8

Предыдущий self-contained пакет шага 8 содержал упрощённый renderer.
Из-за этого он перезатирал более полный `render-approval-prompt.cjs`
и ломал уже существующие unit-тесты.

## Что исправлено

В этом пакете renderer снова выводит все согласованные поля:

- group
- risk
- why this command
- why approval is needed
- expected result
- safer alternatives

## Что делать

Распаковать архив поверх проекта и повторно запустить тесты.

## Важно

Это корректирующий пакет.
Никакой новой архитектуры он не добавляет.
Он только возвращает renderer к уже зафиксированному контракту.
