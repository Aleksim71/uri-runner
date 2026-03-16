URI Runner Runtime Pack


Purpose

Runtime Pack describes minimal runtime modules required to execute scenario RUNBOOK.


Core Runtime Modules

command registry
scenario parser
scenario executor
execution event bus
trace system


Runtime Environment System

Environment reset modules ensure that scenario execution
starts in a deterministic runtime state.

Modules:

stop-managed-processes
cleanup-runtime-state
start-managed-server
run-healthcheck
reset-environment


Execution Path

RUNBOOK
→ compilePlan
→ runPlan
→ environment reset
→ execution events
→ event bus
→ trace recording
→ trace.json
→ outbox.zip
→ history index update


Runtime Systems


Execution Event Bus

Runtime emits execution events describing scenario progress.


Trace System

Execution events are recorded into events.jsonl.

Events are converted into deterministic execution trace:

trace.json


Trace Schema

trace.json contains schema identifier.

schema = uri.trace.v1


Replay System

Runtime supports replay of execution traces.

CLI:

uri replay trace.json


History System

Runtime stores execution traces in:

runtime/traces

Runtime also maintains a compact history index:

runtime/history/index.json

The index provides fast lookup of past runs without scanning the
trace directory.

CLI commands using the history index:

uri history
uri last
uri show <runId>


Outbox Protocol

Runtime produces outbox.zip as final execution artifact.

outbox.zip contains:

outbox.json
optional provided data
