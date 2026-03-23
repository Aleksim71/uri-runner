<!-- path: doc/runtime/A19-cdp-colors-overlay-notes.md -->

# A19 CDP + terminal colors overlay

Пакет добавляет следующий практический слой поверх A19 skeleton:

- `src/runtime/browser/cdp-client.cjs` — адаптер над `chrome-remote-interface` для attach/list/create target;
- `src/runtime/browser/attach-browser-session.cjs` — обновлённый attach-path, который по умолчанию использует CDP adapter;
- `src/runtime/terminal/colors.cjs` — компактный слой цветного вывода поверх `picocolors`;
- `test/unit/cdp-client.test.mjs` — unit tests для CDP adapter без живого браузера через injected transport;
- `test/unit/colors.test.mjs` — unit tests для цветного вывода.

## Что уже делает пакет

- умеет подключаться к CDP через `chrome-remote-interface`;
- умеет перечислять targets;
- умеет attach-иться к выбранной странице;
- буферизует console events и page errors;
- умеет брать screenshot через Page domain;
- даёт маленький re-usable слой для цветных queue/status сообщений.

## Что пакет пока не делает

- не добавляет network summary;
- не добавляет DOM snapshot;
- не встраивает цвета в конкретный reporter автоматически;
- не делает live orchestration вокруг browser launch / confirm steps.

## Следующая точка интеграции

- подключить `src/runtime/browser/cdp-client.cjs` в общий browser flow A19;
- подключить `src/runtime/terminal/colors.cjs` в queue / reporter слой проекта;
- затем прогнать live attach к реальному Chromium с открытым remote debugging endpoint.
