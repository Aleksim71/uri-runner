# URI Runner Documentation Changelog

## 10.03.2026

Initial documentation structure created.

## 13.03.2026

Runtime V3 Stage 2 — A3

Added Outbox protocol.

Changes:

outbox.zip execution package
outbox.json execution report
RUNBOOK provide section
file and file_fragment provide kinds

Internal runtime artifacts are no longer exported automatically.

External AI receives only explicitly requested data.

## 14.03.2026

Runtime V3 Stage 2 — A4 / A5 / A6

Added:

Terminal reporting contract
Execution event bus
Execution trace system
Trace schema versioning
Execution replay command
History command

Trace storage directory:

runtime/traces

## 15.03.2026

Runtime V3 Stage 2 — A7

Added history index system.

New artifact:

runtime/history/index.json

Purpose:

fast history lookup
support uri history
support uri last
support uri show <runId>

Trace files remain canonical run records.

History index acts as a compact navigation layer over completed runs.

## 16.03.2026

Runtime V3 Stage 2 — A8

Runtime finalize contract stabilized.

Resolved regression between pipeline runtime and finalize layer.

Key changes:

latest outbox contract finalized.

Success runs:
latest outbox stored as ZIP artifact containing minimal outbox.json payload.

Error runs:
latest outbox stored as JSON runtime summary.

History artifact contract finalized.

Each run produces:

history/<runId>__<engine>__OK.outbox.zip  
history/<runId>__<engine>__ERR.outbox.zip

History index compatibility layer added.

Structured format:

{
  "version": 1,
  "runs": [...]
}

Legacy array format preserved for error-path compatibility.

Scenario runtime tests fully stabilized.

Test status:

40 test files passed  
84 tests passed

CLI layer  
Scenario runtime  
Finalize pipeline  
History index system  

are now fully green.

Additional runtime system introduced:

Environment Reset Pipeline.

Environment reset executes automatically before scenario execution
when runtime.environment.reset_before_run = true.

Runtime modules added:

stop-managed-processes  
cleanup-runtime-state  
start-managed-server  
run-healthcheck  
reset-environment
