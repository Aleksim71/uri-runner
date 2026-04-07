# path: test/real/_docs/URI_PROFILE_DOCUMENTATION_V1.md

# URI profile-first documentation v1

## Главный принцип

Документируем не просто команды, а их поведение через профиль исполнения:

```text
command -> profile -> reaction contract -> real test
```

## Обязательные слои документации

1. **Commands registry** — какие команды нужны на первом этапе
2. **Profiles registry** — к какому профилю относится команда
3. **Reaction contract** — как URI должен реагировать на профиль
4. **Real tests registry** — как этот профиль проверяется через inbox/outbox

## Формула reaction contract

Для каждого профиля фиксируются:

- `success`
- `timing`
- `retry`
- `failure`
- `cleanup/report`

## Первые 6 профилей MVP

1. `quick`
2. `service_start`
3. `db_query`
4. `db_migration`
5. `browser_action`
6. `interactive_risk`

## Шаблон записи профиля

```text
Profile:
Goal:
Typical commands:
Success:
Timing:
Retry:
Failure:
Cleanup/Report:
Real tests:
```
