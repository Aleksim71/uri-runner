<!-- path: doc/runtime/A19-code-package-notes.md -->

# A19 code package notes

Этот пакет — **overlay** для проекта `uri-runner` с путями от корня проекта.

Что входит:
- browser runtime modules для A19.1;
- минимальный browser approval/policy каркас;
- unit tests;
- один scenario test;
- ранее подготовленные A19 contracts/docs.

Что важно:
- пакет собран **без прямой привязки к конкретной browser library**;
- attach и collect работают через **adapter / client injection**;
- это сделано специально, чтобы не навязывать проекту Playwright, Puppeteer или иной конкретный транспорт до отдельного инфраструктурного решения.

Практический смысл:
- можно встроить browser transport позже;
- контракты, normalizer и artifact writer уже готовы;
- тесты можно запускать на fake adapter/client без реального браузера.

Ожидаемые точки интеграции в проекте:
- orchestration layer вызывает `handleBrowserStepPolicy(...)`;
- если решение `allow`, запускается `attachBrowserSession(...)`;
- затем `collectBrowserArtifacts(...)`;
- затем `normalizeBrowserResult(...)`;
- затем `writeBrowserArtifacts(...)`;
- дальше уже существующий watcher/outbox layer может включать эти файлы в `outbox.zip`.

Ограничение этого пакета:
- здесь **нет готового live-transport к DevTools/CDP**;
- есть безопасный контрактный слой и тестируемый runtime skeleton для A19.1.
