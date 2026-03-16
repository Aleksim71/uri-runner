URI Runner Documentation Changelog


10.03.2026

Initial documentation structure created.


13.03.2026

Runtime V3 Stage 2 — A3

Added Outbox protocol.

Changes:

outbox.zip execution package
outbox.json execution report
RUNBOOK provide section
file and file_fragment provide kinds

Internal runtime artifacts are no longer exported automatically.

External AI receives only explicitly requested data.


14.03.2026

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


15.03.2026

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
