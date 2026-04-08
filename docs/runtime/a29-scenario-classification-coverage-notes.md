# A29.1c — scenario classification coverage notes

## Что проверяет пакет

Этот пакет не меняет runtime-код `scenario`-слоя. Он расширяет точечное покрытие вокруг уже встроенного
`scenario command registry preflight`.

Добавлены проверки для двух важных сценариев:

1. `preflightScenarioPlan()` сохраняет список уже известных шагов, но запрашивает классификацию только
   для неизвестного browser action.
2. `runPlan()` останавливает **весь** scenario-план до исполнения первого шага, если в плане есть
   неизвестный browser action и registry включён.

## Почему это важно

Для `scenario`-слоя важно доказать не только `unknown command -> classification_required`, но и
более опасный случай смешанного плана:

- первый шаг известный и потенциально исполнимый;
- следующий browser step неизвестен.

Правильное поведение для MVP:
- не исполнять даже первый известный шаг;
- вернуть `classification_required`;
- приложить `classification_request` с описанием неизвестного browser action.

## Что дальше

Следующий этап после этого пакета:
- A29.1d — `classification-response -> update registry -> rerun preflight -> execute` для scenario-слоя.
