<!-- path: /doc/runtime/contracts/URI_TERMINAL_USER_DECISION_PROTOCOL_V1.md -->

# URI_TERMINAL_USER_DECISION_PROTOCOL_V1

Статус: draft v1  
Проект: uri-runner  
Дата: 2026-03-23

---

## 1. Цель

Определить минимальный и детерминированный протокол,
по которому URI принимает пользовательское решение
во время terminal approval flow.

Этот документ выделен отдельно,
чтобы реализацию можно было делать маленьким шагом:

- отдельно от policy;
- отдельно от sandbox execution;
- отдельно от full watcher UI.

---

## 2. Базовая идея

В v1 пользователь принимает одно из трёх решений:

- разрешить текущий step;
- отклонить текущий step;
- остановить весь run.

Протокол должен быть:

- коротким;
- легко читаемым;
- устойчивым к случайному вводу;
- одинаковым для всех ask-step в `strict_safe`.

---

## 3. Нормализованные решения

Поддерживаются только три normalized decision:

- `approve`
- `deny`
- `abort`

Любое другое значение считается `invalid_input`.

---

## 4. Таблица допустимого ввода

### `approve`

Допустимый raw input:

- empty line
- `y`
- `Y`

### `deny`

Допустимый raw input:

- `n`
- `N`

### `abort`

Допустимый raw input:

- `q`
- `Q`

---

## 5. Правило Enter alias

Пустой ввод через `Enter` обязан трактоваться как `approve`.

Это решение принято специально,
чтобы confirm-flow не тормозил рабочий процесс,
когда пользователь уже прочитал watcher summary
и согласен выполнить шаг.

---

## 6. Нормализация ввода

Перед интерпретацией URI обязан:

1. прочитать одну строку input;
2. убрать завершающий newline;
3. trim-применить пробелы по краям;
4. нормализовать регистр.

После этого решение определяется строго по таблице допустимых значений.

---

## 7. Поведение при ошибочном вводе

Если значение не распознано,
URI не должен:

- исполнять step;
- менять policyDecision;
- переходить к следующему шагу.

URI обязан:

1. вывести краткое сообщение об ошибке;
2. повторно показать допустимые варианты;
3. повторно запросить ввод;
4. остаться на том же step.

Рекомендуемое сообщение:

```text
Unknown decision. Use [Y/Enter = yes] [N = no] [Q = abort]
```

---

## 8. Контракт функции normalize

Рекомендуемая сигнатура:

```js
normalizeApprovalInput(rawInput) -> {
  ok: boolean,
  decision: 'approve' | 'deny' | 'abort' | null,
  normalizedInput: string,
  errorCode: string | null
}
```

### Рекомендуемые `errorCode`

- `APPROVAL_INPUT_EMPTY_APPROVE`
- `APPROVAL_INPUT_APPROVE`
- `APPROVAL_INPUT_DENY`
- `APPROVAL_INPUT_ABORT`
- `APPROVAL_INPUT_INVALID`

Коды не обязательны для CLI-UX,
но полезны для trace/debug.

---

## 9. Контракт применения решения

### `approve`

- step начинает исполнение;
- watcher меняет статус на `running`;
- trace фиксирует allow-event.

### `deny`

- step не исполняется;
- watcher меняет статус на `denied_by_user`;
- run завершается как user-blocked или переводит хвост в `skipped`.

### `abort`

- текущий step не исполняется;
- watcher меняет статус на `aborted_by_user`;
- run полностью останавливается;
- последующие шаги = `skipped`.

---

## 10. Почему `abort` нужен отдельно

`deny` и `abort` нельзя смешивать.

### `deny`

Пользователь не разрешил **конкретный step**.

### `abort`

Пользователь решил **остановить весь run**.

Разделение важно для:

- правильного final status;
- корректной диагностики;
- точного trace;
- будущих сценариев, где `deny` одного шага
  не обязательно должен останавливать весь pipeline.

---

## 11. Минимальные тест-кейсы

Для первой реализации стоит покрыть минимум такие случаи:

1. `""` → `approve`
2. `"y"` → `approve`
3. `"Y"` → `approve`
4. `"n"` → `deny`
5. `"N"` → `deny`
6. `"q"` → `abort`
7. `"Q"` → `abort`
8. `" y "` → `approve`
9. `" nope "` → invalid
10. `"yes"` → invalid
11. `"1"` → invalid

---

## 12. Минимальные implementation notes

Для первого шага реализации достаточно:

- отдельного small helper для normalize;
- unit test файла только под этот helper;
- без завязки на full sandbox/runtime.

Это хороший безопасный слой для пошаговой интеграции:

1. сначала helper + tests;
2. потом watcher prompt renderer;
3. потом wiring в execution flow.

---

## 13. Итог

`URI_TERMINAL_USER_DECISION_PROTOCOL_V1`
фиксирует простой, быстрый и однозначный протокол ответа пользователя
в terminal approval flow.

Он нужен, чтобы confirm в URI был не “примерным”,
а формальным и повторяемым:

- `Enter/Y` = approve
- `N` = deny
- `Q` = abort

Это маленький, но очень важный кирпич
для безопасной terminal execution модели.
