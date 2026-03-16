# URI Runner Documentation Index


------------------------------------------------
Overview
------------------------------------------------

URI Runner documentation is organized into several logical layers:

1 Runtime architecture
2 Execution lifecycle
3 Runtime modules
4 System contexts
5 Artifact protocols
6 CLI interface
7 Change history


------------------------------------------------
Core Architecture
------------------------------------------------

Runtime Pack

doc/runtime/runtime-pack.md

Describes core runtime modules and execution pipeline.


Execution Lifecycle

doc/runtime/execution-lifecycle.txt

Defines canonical execution phases of URI.


Environment Reset System

doc/runtime/environment-reset.md

Describes environment reset pipeline executed before scenario execution.

Modules:

stop-managed-processes  
cleanup-runtime-state  
start-managed-server  
run-healthcheck  
reset-environment


------------------------------------------------
Executable Context System
------------------------------------------------

Executable Context Runtime

doc/system/executable-context-runtime.md

Describes the executable.yaml mechanism used to define
project execution scenarios.


------------------------------------------------
Execution Artifacts
------------------------------------------------

Run Sandbox System

Each execution run is isolated inside its own runtime sandbox.

Structure:

runtime/runs/<runId>/

Contained artifacts:

traces  
artifacts  
provided  
logs  
tmp


Trace System

Execution traces are stored inside run sandbox:

runtime/runs/<runId>/traces


History System

runtime/history/index.json

History index used by CLI commands:

uri history  
uri last  
uri show <runId>


Outbox Protocol

Execution result package.

Artifact:

outbox.zip


------------------------------------------------
Runtime Execution Pipeline
------------------------------------------------

Canonical pipeline:

RUNBOOK / executable.yaml
        ↓
compilePlan
        ↓
plan validation
        ↓
run sandbox initialization
        ↓
environment reset
        ↓
scenario execution
        ↓
execution events
        ↓
trace recording
        ↓
outbox packaging
        ↓
history persistence


------------------------------------------------
CLI Commands
------------------------------------------------

Core commands:

uri run
uri history
uri last
uri show <runId>
uri replay trace.json


------------------------------------------------
Documentation Change History
------------------------------------------------

doc/changelog.md


------------------------------------------------
Documentation Structure
------------------------------------------------

doc/

  index.md

  changelog.md

  runtime/

      execution-lifecycle.txt
      runtime-pack.md
      environment-reset.md

  system/

      executable-context-runtime.md


------------------------------------------------
Documentation Rules
------------------------------------------------

Documentation files must follow these principles:

1 deterministic structure  
2 minimal redundancy  
3 architecture first  
4 implementation details second  

The documentation index must remain the primary entry point
for both developers and AI agents.


------------------------------------------------
END
------------------------------------------------
