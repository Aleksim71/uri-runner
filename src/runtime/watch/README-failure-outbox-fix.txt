# path: src/runtime/watch/README-failure-outbox-fix.txt

Назначение:
- гарантировать, что при execution failure файл `outbox.zip` всегда остаётся валидным zip-архивом

Когда вызывать:
- в catch-блоке watcher execution pipeline
- в любом fail-path, где сейчас пишется `outbox.zip` напрямую как текст / json / stack trace

Минимальная интеграция:

```js
const { writeFailureOutbox } = require('../runtime/watch/write-failure-outbox.cjs');

try {
  // existing execution flow
} catch (error) {
  writeFailureOutbox({
    targetZip: transportOutboxPath,
    stage: 'execution',
    project: projectName,
    receiver: 'uri',
    profile: runbook && runbook.profile,
    runbookJson: compiledRunbookOrRawRunbook,
    error
  });

  log('status: execution failed');
  log('outbox: ' + transportOutboxPath);
}
```

Что должно получиться в архиве:
- STATUS.json
- SNAPSHOT.txt
- REPORT/error.json
- REPORT/error.txt
- REPORT/runbook.json (если передан runbookJson)

Почему это важно:
- downstream-инструменты ожидают именно zip
- даже при ошибке fail-path должен соблюдать outbox contract
