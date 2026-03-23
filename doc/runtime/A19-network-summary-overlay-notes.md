# path: doc/runtime/A19-network-summary-overlay-notes.md

# A19 Network Summary Integration

Этот overlay добавляет следующий практический слой для A19 Browser Diagnostics:

- живой сбор `network-summary.json` через CDP `Network` domain;
- буферизацию `requestWillBeSent`, `responseReceived`, `loadingFailed`;
- нормализованный network summary без request/response body и без чувствительных данных;
- перенос `totalRequestCount` и `failedRequestCount` в `browser-report.json`.

## Что меняется

### `src/runtime/browser/cdp-client.cjs`

Добавлено:
- включение `Network.enable()` при attach;
- буферизация сетевых событий по `requestId`;
- новый метод `getNetworkSummary({ settleMs })`;
- сводка по:
  - `requests`
  - `totalRequests`
  - `failedRequests`
  - `statusCodeBuckets`
  - `resourceTypeBuckets`

### `src/runtime/browser/collect-browser-artifacts.cjs`

Добавлено:
- `networkSettleMs` в options;
- реальный сбор `networkSummary` через diagnostics client;
- артефакт `network-summary.json`;
- `counts.totalRequests` и `counts.failedRequests`;
- `warning`-status, если есть failed requests.

### `src/runtime/browser/normalize-browser-result.cjs`

Добавлено:
- `network-summary.json` в нормализованный artifact bundle;
- `totalRequestCount` и `failedRequestCount` в `browser-report.json`.

## Почему это отдельный слой

После предыдущих пакетов A19 уже умел:
- attach к CDP;
- собирать screenshot + metadata;
- собирать live `console.json` и `errors.json`;
- писать артефакты на диск;
- проходить живой end-to-end путь `attach -> collect -> normalize -> write`.

Следующим логичным слоем стал именно safe `network-summary.json`, потому что он:
- остаётся в safe browser scope;
- полезен для frontend/runtime диагностики;
- не требует чтения request/response body, cookies или storage.

## Ограничение

Этот overlay не добавляет:
- `dom.html`;
- `screenshot-full.png`;
- trace/performance profiling;
- CLI entrypoint для browser diagnostics.

Это следующий слой после стабилизации safe network summary.
