URI Runner
A7 code package

Included:
- history index runtime layer
- trace finalizer integration
- history CLI update
- new CLI command files:
  - src/cli/commands/last.cjs
  - src/cli/commands/show.cjs

Important:
- src/cli/index.cjs was not provided in the chat.
- Because of that, last/show command wiring into the top-level CLI dispatcher
  is NOT included in this package.
- The files here are ready, but src/cli/index.cjs still needs to import and
  route:
    uri last
    uri show <runId>

Expected runtime artifact:
- runtime/history/index.json
