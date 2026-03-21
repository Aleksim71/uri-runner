A16 happy path inbox for live watcher test.

Исправление:
- project: uri-runner

Ожидание:
- watcher принимает inbox.zip
- run-plan проходит project resolution
- в processed появляется outbox.zip
- в outbox.json можно проверить fileDeliveryReport для A16
