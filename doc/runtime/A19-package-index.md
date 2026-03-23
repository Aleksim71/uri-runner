<!-- path: doc/runtime/A19-package-index.md -->

# A19 package index

Этот пакет содержит **готовые стартовые markdown-файлы** для открытия A19 в проекте `uri-runner`.

## Состав пакета

### Contracts
- `doc/runtime/contracts/browser-approval-explanation.md`
- `doc/runtime/contracts/browser-approval-prompt.md`
- `doc/runtime/contracts/browser-attach-sequence.md`
- `doc/runtime/contracts/browser-artifacts-contract.md`

### Runtime docs
- `doc/runtime/A19-browser-diagnostics-v1-implementation.md`
- `doc/runtime/A19_URI_Mitya_Start_Prompt.md`
- `doc/runtime/A19-piligrim-block.md`
- `doc/runtime/A19-package-index.md`

## Что входит

В пакет входят:
- рамка безопасности A19;
- contracts для browser diagnostics;
- практический implementation plan;
- стартовый prompt для URI / Мити;
- готовый Piligrim-блок.

## Что не входит

В этот пакет **не входят кодовые файлы реализации**, потому что в текущем чате мы их ещё не писали и не тестировали.

Это **документационный стартовый пакет A19**, готовый для распаковки поверх проекта.
## Code overlay files

### Runtime modules
- `src/runtime/browser/attach-browser-session.cjs`
- `src/runtime/browser/collect-browser-artifacts.cjs`
- `src/runtime/browser/normalize-browser-result.cjs`
- `src/runtime/browser/write-browser-artifacts.cjs`

### Approval / policy modules
- `src/runtime/browser/normalize-browser-approval-input.cjs`
- `src/runtime/browser/build-browser-approval-view-model.cjs`
- `src/runtime/browser/render-browser-approval-prompt.cjs`
- `src/runtime/browser/handle-browser-step-policy.cjs`

### Tests
- `test/unit/attach-browser-session.test.mjs`
- `test/unit/collect-browser-artifacts.test.mjs`
- `test/unit/normalize-browser-result.test.mjs`
- `test/unit/write-browser-artifacts.test.mjs`
- `test/scenarios/browser-flow.diagnostics-report.test.mjs`

### Notes
- `doc/runtime/A19-code-package-notes.md`
