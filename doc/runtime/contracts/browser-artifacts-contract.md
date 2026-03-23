<!-- path: doc/runtime/contracts/browser-artifacts-contract.md -->

# Browser artifacts contract

## Назначение

Этот документ задаёт состав и смысл browser artifacts для A19.

Главный результат работы URI — не просто лог, а **переносимый пакет контекста**, пригодный для анализа Максом и для включения в `outbox.zip`.

---

## A19.1 — минимальный обязательный набор

Для первой рабочей итерации A19.1 обязательны:

- `page-metadata.json`
- `screenshot.png`
- `console.json`
- `errors.json`
- `browser-report.json`

---

## Смысл каждого артефакта

### `page-metadata.json`

Должен содержать минимум:

- URL страницы;
- title страницы;
- browser type;
- attach status;
- timestamp;
- при наличии — target id.

### `screenshot.png`

Скриншот текущего визуального состояния страницы.

Требование:
- один обычный screenshot для A19.1;
- full-page screenshot можно добавить позже.

### `console.json`

Нормализованный список console messages.

Желательные поля:
- level;
- text;
- timestamp;
- source / location, если доступны.

### `errors.json`

Нормализованный список browser/runtime errors.

Желательные поля:
- code / type;
- text;
- source;
- stack, если безопасно и доступно;
- timestamp.

### `browser-report.json`

Короткая сводка по результату browser diagnostics.

Должен содержать минимум:

- `kind: "browser-diagnostics"`
- `status: "ok" | "warning" | "failed"`
- цель диагностики;
- `targetUrl`
- `targetTitle`
- `attachStatus`
- `consoleErrorCount`
- список артефактов;
- warnings / errors summary.

---

## A19.2 — расширение, но не часть A19.1

Допустимые будущие расширения:

- `screenshot-full.png`
- `dom.html`
- `network-summary.json`

Они **не обязательны** для первого рабочего среза A19.1.

---

## Чего не должно быть в safe artifacts

В safe artifacts по умолчанию не должно быть:

- cookies;
- storage dump;
- auth headers;
- request/response bodies;
- приватных данных пользовательской сессии;
- произвольного JS execution output.

---

## Запись и упаковка

Все browser artifacts должны:

1. писаться в контролируемую sandbox-область;
2. получать понятные относительные пути;
3. попадать в общий переносимый пакет результата;
4. по возможности включаться в `outbox.zip`.

---

## Правило минимально достаточного контекста

URI не должен собирать всё подряд.

Правильный принцип:
- если достаточно `screenshot + console + errors`, собирать только их;
- расширенные artifacts собирать только по цели и по allow/confirm-правилам.

---

## Короткий итог

Для A19.1 нужен **не максимальный**, а **достаточный и безопасный** набор browser artifacts.
