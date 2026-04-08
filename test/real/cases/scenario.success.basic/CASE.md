# path: test/real/cases/scenario.success.basic/CASE.md

# scenario.success.basic

Цель: проверить полный truth-cycle `inbox.zip -> watch --once -> outbox.zip` для базового scenario-run с известной named-командой `system.echo`.

Ожидание:
- watcher принимает inbox;
- scenario выполняется успешно;
- финальный outbox имеет `status: success`.
