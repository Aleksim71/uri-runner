# path: test/real/cases/scenario.classification_response.applies_and_executes/CASE.md

# scenario.classification_response.applies_and_executes

Проверяет полный scenario-cycle A30.1:

1. В inbox лежит scenario-runbook с project command `project.local-hello`.
2. Команда существует в `PROJECT/contexts/project/commands`, но отсутствует в registry.
3. Там же лежит `scenario-classification-response.yaml`.
4. URI применяет classification-response к scenario registry.
5. Затем повторно делает preflight.
6. После успешного preflight выполняет scenario-step и отдаёт success.
