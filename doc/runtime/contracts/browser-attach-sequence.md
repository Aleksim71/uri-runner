<!-- path: doc/runtime/contracts/browser-attach-sequence.md -->

# Browser attach sequence

## Назначение

Этот документ задаёт базовую последовательность attach для A19.1.

На первом этапе используется модель:

- **manual prep** — пользователь сам подготовил браузер и страницу;
- URI выполняет **attach** к разрешённой diagnostic session;
- URI собирает safe browser artifacts;
- URI возвращает нормализованный результат.

---

## Входные предпосылки

Перед attach в A19.1 предполагается:

1. браузер уже открыт;
2. нужная страница уже открыта;
3. доступна **разрешённая** diagnostic session;
4. URI не работает с обычным пользовательским profile.

---

## Базовая последовательность

### Шаг 1. Нормализация запроса

URI приводит browser request к узкому виду:

- цель;
- target hint;
- requested artifacts;
- policy hint.

### Шаг 2. Policy decision

URI определяет решение:

- `allow`
- `confirm`
- `deny`

Для A19.1 attach к разрешённой diagnostic session обычно относится к `allow`.

### Шаг 3. Attach

URI:

- подключается к diagnostic endpoint;
- получает список доступных target-страниц;
- выбирает target по `urlIncludes` / `titleIncludes`, если такие подсказки даны;
- возвращает attach-result.

Attach-result должен содержать минимум:

- `status`
- `browserType`
- `endpoint`
- `targetId`
- `targetUrl`
- `targetTitle`
- `warnings`
- `error`

### Шаг 4. Collect

Если attach успешен, URI собирает safe artifacts A19.1:

- `page-metadata.json`
- `screenshot.png`
- `console.json`
- `errors.json`
- `browser-report.json`

### Шаг 5. Normalize result

URI объединяет attach + collect в единый `browser-diagnostics` result.

### Шаг 6. Write artifacts

URI пишет артефакты в sandbox и возвращает paths / manifest.

---

## Минимальные ошибки attach

Для первой версии достаточно предусмотреть такие error codes:

- `attach_failed`
- `target_not_found`
- `timeout`
- `invalid_endpoint`
- `forbidden_profile`

---

## Поведение при неуспехе

- Неуспешный attach должен давать нормализованный `failed` или `warning` result.
- Browser attach failure не должен автоматически валить весь watcher.
- Фатальным сбой считается только отдельный конфигурационный класс ошибки, если он явно определён выше уровнем orchestration.

---

## Что не входит в A19.1

В attach sequence первой версии не входят:

- auto-launch браузера как обязательный этап;
- работа с cookies/storage;
- request/response bodies;
- arbitrary JS evaluation;
- управление GUI DevTools.

---

## Короткий итог

A19.1 attach sequence:

**manual prep → allow/confirm policy → attach → collect safe artifacts → normalize → write**
