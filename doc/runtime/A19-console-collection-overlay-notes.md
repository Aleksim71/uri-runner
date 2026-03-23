# path: doc/runtime/A19-console-collection-overlay-notes.md

# A19 Console Collection Live Integration

Этот overlay добавляет следующий практический слой для A19 Browser Diagnostics:

- живой сбор `console.json` через CDP;
- живой сбор `errors.json` через `Runtime.exceptionThrown` и `Log.entryAdded`;
- единый snapshot-путь `getConsoleSnapshot({ settleMs })`, чтобы collector не делал несогласованные чтения `console` и `errors` по отдельности;
- нормализованные поля для `console.json` и `errors.json`, пригодные для `browser-report.json` и для анализа Максом.

## Что меняется

### `src/runtime/browser/cdp-client.cjs`

Добавлено:
- нормализация console/event payload;
- буферизация `Runtime.consoleAPICalled`, `Runtime.exceptionThrown`, `Log.entryAdded`;
- новый метод `getConsoleSnapshot({ settleMs })`;
- `getConsoleMessages()` и `getPageErrors()` теперь читают через общий snapshot.

### `src/runtime/browser/collect-browser-artifacts.cjs`

Добавлено:
- `consoleSettleMs` в options;
- предпочтение `client.getConsoleSnapshot()` вместо двух отдельных чтений;
- нормализация `console.json` и `errors.json` перед сохранением в артефакты;
- корректные counts для `consoleMessageCount`, `consoleErrorCount`, `pageErrorCount`.

## Почему это отдельный слой

После предыдущих пакетов A19 уже умел:
- attach к CDP;
- собирать screenshot + metadata;
- писать артефакты на диск;
- проходить живой end-to-end путь `attach -> collect -> normalize -> write`.

Следующим логичным слоем стал именно live console path, потому что он:
- остаётся в safe browser scope;
- очень полезен для frontend/runtime диагностики;
- не требует захода в cookies/storage/body/network payload.

## Ограничение

Этот overlay не добавляет:
- `network-summary.json`;
- `dom.html`;
- `screenshot-full.png`;
- CLI entrypoint для browser diagnostics.

Это следующий слой после стабилизации live console collection.
