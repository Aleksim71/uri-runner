<!-- path: doc/runtime/A19-real-artifacts-overlay-notes.md -->

# A19 real artifacts overlay

Этот пакет переводит A19 из уровня ручного smoke-скрипта в нормальный runtime path внутри проекта.

## Что добавлено

- `src/runtime/browser/run-browser-diagnostics.cjs`
  - единая оркестрация: `attach -> collect -> normalize -> write`;
  - закрывает client quietly после записи артефактов;
  - подходит для минимального safe-сценария `metadata + screenshot`.

- `src/runtime/browser/collect-browser-artifacts.cjs`
  - теперь обогащает `page-metadata.json` данными сессии:
    - `endpoint`
    - `targetId`
    - `browserType`
    - fallback по `url/title/type`;
  - корректно считает пустой screenshot invalid payload и даёт warning.

- `src/runtime/browser/cdp-client.cjs`
  - metadata теперь знает `endpoint` и `targetId`;
  - добавлена внутренняя логика выбора page target.

## Практический смысл

После этого overlay A19 умеет не только attach-нуться к браузеру, но и пройти полный минимальный путь:

1. найти target;
2. собрать `page-metadata.json`;
3. собрать `screenshot.png`;
4. нормализовать результат;
5. записать артефакты и `browser-report.json`.

Это уже соответствует живому smoke-path, который был подтверждён вручную через CDP на реальном Chrome.

## Что этот пакет пока не делает

- не добавляет DOM snapshot;
- не добавляет network summary;
- не делает full-page screenshot;
- не встраивает orchestration в watcher/CLI command surface;
- не заменяет confirm/policy слой для launch/reload/open-url.

## Следующий слой

Логичное продолжение после этого пакета:

- добавить `fullPageScreenshot`;
- добавить `console + errors` как второй практический артефактный набор;
- затем выйти на `network-summary.json` без body.
