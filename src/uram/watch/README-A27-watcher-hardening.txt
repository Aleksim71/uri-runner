# path: src/uram/watch/README-A27-watcher-hardening.txt

Назначение:
- устранить "заикание" watcher'а
- обеспечить terminal handling для rejected inbox
- добавить dedupe (анти-повтор)

Как интегрировать:

1) В watcher (где принимается решение ignored/accepted) подключить:

const { handleIntakeDecision } = require('./watch/intake-decision.cjs');

2) После определения decision:

handleIntakeDecision({
  sourceFile: absolutePathToInboxZip,
  rejectedDir: path.join(projectRoot, 'runtime/watch/processed/rejected'),
  decision: 'ignored',
  reason: 'foreign_receiver',
  log: (line) => console.log(line)
});

3) Удалить старую логику, где ignored просто логируется без перемещения.

Ожидаемое поведение:

- один inbox.zip → один лог ignored
- файл перемещается в runtime/watch/processed/rejected
- watcher больше не реагирует на него повторно
- при повторном скане dedupe предотвращает спам

Важно:
- dedupe in-memory → сбрасывается при рестарте процесса
- это нормально для v1
