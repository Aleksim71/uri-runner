# scenario.classification_response.browser_applies_and_executes

Profile: `scenario`

Цель:
- прогнать полный truth-cycle `inbox.zip -> watch --once -> outbox.zip`;
- использовать `browser.flow` с валидным browser action;
- получить unknown action на scenario preflight через case-local registry;
- применить inline scenario classification response;
- получить итоговый `success`.
