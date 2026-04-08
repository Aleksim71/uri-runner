# scenario.classification_required.unknown_browser_action

Profile: `scenario`

Цель:
- прогнать полный truth-cycle `inbox.zip -> watch --once -> outbox.zip`;
- использовать `browser.flow` с валидным browser action;
- через case-local scenario registry сделать этот action неизвестным для preflight;
- получить `classification_required` до исполнения.
