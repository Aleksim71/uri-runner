<!-- path: doc/runtime/contracts/browser-approval-explanation.md -->

# Browser approval explanation

## Назначение

Этот документ объясняет, **как URI должен принимать решения** для browser diagnostics слоя A19.

A19 открывается **после завершения A18** и должен повторять уже закреплённую архитектуру проекта:

1. approval / policy
2. raw browser diagnostics collection
3. result normalization
4. artifact writing
5. trace / outbox / history integration

Browser diagnostics нужен **не для GUI-управления DevTools ради самого GUI**, а для получения диагностического контекста страницы:

- визуального состояния UI;
- ошибок консоли;
- симптомов сетевых проблем;
- DOM-снимка;
- page metadata;
- краткого browser report.

---

## Главный принцип

URI работает с **диагностическим интерфейсом браузера**, а не с обычным пользовательским browser profile.

Нужны **данные**, а не “кликание по DevTools”.

---

## Уровни допуска

### SAFE

SAFE-действия можно выполнять без отдельного подтверждения пользователя, если они:

- локальные;
- узкие и предсказуемые;
- read-only или низкорисковые;
- не читают приватное browser state;
- не меняют внешний мир;
- не используют браузер как обход пользовательской авторизации.

Для A19.1 к SAFE обычно относятся:

- attach к **разрешённой** diagnostic session;
- чтение page metadata;
- screenshot;
- console messages;
- errors report.

### CONFIRM

CONFIRM требуется, если действие:

- может менять состояние браузера или страницы;
- расширяет поверхность доступа;
- может повлиять на процессы или dev-среду;
- открывает новую вкладку, URL или отдельный browser instance;
- требует trace / performance capture или reload.

Для A19.1 в CONFIRM относятся:

- запуск браузера URI из терминала;
- открытие нового URL;
- reload страницы;
- переключение вкладок;
- trace/performance capture.

### FORBIDDEN BY DEFAULT

Запрещено по умолчанию всё, что связано с приватным browser state или даёт слишком широкий доступ.

Для A19.1 запрещено по умолчанию:

- cookies;
- `localStorage` / `sessionStorage` / `IndexedDB`;
- request body / response body;
- auth headers;
- произвольный JS в контексте страницы;
- attach к обычному пользовательскому browser profile;
- использование браузера как канала доступа к уже авторизованной пользовательской сессии.

---

## Правило сомнения

Если действие не укладывается однозначно в SAFE:

1. сначала считать его `CONFIRM`;
2. если риск высокий — считать `FORBIDDEN BY DEFAULT`,
   пока не появится отдельное правило.

---

## Правило узкой команды

Если цель можно решить несколькими способами, URI выбирает **самый узкий и безопасный**.

Примеры:

- лучше `screenshot + console`, чем чтение storage;
- лучше `page metadata`, чем широкий dump browser state;
- лучше attach к разрешённой сессии, чем работа с обычным пользовательским профилем.

---

## Поведение при сбое

Browser failure **не должен автоматически становиться фатальным watcher failure**, если нет отдельного `config_error` или другого специального класса фатальной причины.

Это продолжает архитектурный принцип A18:
**execution failure != watcher failure**.

---

## Короткий итог

A19.1 — это **safe browser diagnostics layer**, а не полноценный browser control layer.

Правильная модель:

**цель → нужные данные → способ получения → режим допуска → артефакты → анализ Максом**
