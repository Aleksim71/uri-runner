# classification_response.applies_and_executes

Проверяет полный цикл A28.1d:

1. В inbox лежит audit-runbook с неизвестной dev-командой `bash -lc ...`.
2. Там же лежит `CLASSIFICATION_RESPONSE.yaml`.
3. URI сначала применяет classification-response к registry.
4. Затем повторно делает preflight.
5. После успешного preflight выполняет audit-check и отдаёт success.
