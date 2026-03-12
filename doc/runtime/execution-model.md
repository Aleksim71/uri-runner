URI Runtime Execution Model (v2)

This document describes the actual execution model of URI Runtime v2.

Purpose

URI Runtime v2 executes a project scenario from inbox.zip using:

- RUNBOOK.yaml
- project resolution via config/projects.yaml
- execution policy via contexts/system/executable.yaml

The runtime is context-aware: execution depends both on the run request and on the execution context.

Execution Flow

uri run
↓
inbox.zip
↓
RUNBOOK.yaml
↓
validate runbook
↓
resolve project via config/projects.yaml
↓
load executable context
↓
select engine
↓
acquire execution lock
↓
parse scenario
↓
execute scenario
↓
write outbox
↓
update latest/history
↓
move inbox to processed


Runtime Inputs

Inbox Archive

Runtime expects:

Inbox/inbox.zip

The archive must contain:

RUNBOOK.yaml


Project Registry

Runtime resolves the target project through:

config/projects.yaml

Minimal example:

version: 1
projects:
  demo:
    cwd: /absolute/path/to/project

This file is required for project resolution.


Executable Context

Runtime loads execution policy from:

contexts/system/executable.yaml

Minimal contract:

version: 1

engine: scenario

commands:
  roots:
    - system
    - project

runtime:
  max_steps: 100
  strict_commands: true


Meaning:

engine — execution engine (scenario or audit)

commands.roots — allowed command namespaces

runtime.max_steps — scenario step limit

runtime.strict_commands — unknown commands must fail execution


RUNBOOK Contract (v2)

Minimal scenario runbook:

version: 1
project: demo
steps:
  - id: step_echo_1
    command: system.echo
    args:
      message: "hello"

Required fields:

version — must be 1

project or meta.project — target project

steps — non-empty array for scenario execution


Scenario Step Contract (actual v2)

Each scenario step must use the following shape:

- id: step_echo_1
  command: system.echo
  args:
    message: "hello"

Required fields:

id — non-empty unique step identifier

command — non-empty command name

args — command arguments object


Example:

steps:
  - id: step_echo_1
    command: system.echo
    args:
      message: "hello from smoke"


Engines

URI Runtime v2 supports two engines:

scenario
audit


Scenario engine

loads commands

parses scenario

executes steps sequentially

writes scenario outbox payload


Audit engine

runs audit flow

writes audit result


Scenario Runtime Behavior

Scenario runtime performs the following steps:

collect command names from runbook

load matching commands into registry

parse scenario

execute steps sequentially

return execution result

write outbox

finalize run


Command Resolution

Commands are loaded through the command registry and command loader.

Example command:

system.echo


The runtime must fail predictably when an unknown command is requested in strict mode.


Runtime Guarantees Confirmed in v2

Happy path

The runtime can:

read RUNBOOK.yaml from inbox.zip

resolve project from config/projects.yaml

load contexts/system/executable.yaml

parse scenario

execute system.echo

write outbox

move inbox to processed


Negative path

The runtime fails on unknown command when strict mode is enabled.


Outbox Finalization

After execution runtime performs:

temporary outbox rename into history

latest outbox update

history index append

processed inbox move


Main output areas:

latest
history
processed


Locking

Execution uses per-project lock files.

Purpose:

prevent overlapping runs

make runtime deterministic


Lock lifecycle

acquire lock
↓
run engine
↓
release lock


Scope of v2

Included in v2

uri run

RUNBOOK.yaml

project resolution

executable context

scenario engine

audit engine

command loading

execution lock

outbox pipeline

runtime tests


Not included in v2

nested scenarios

parallel execution

context graph

distributed runners

multi-context inheritance


Status

URI Runtime v2 is a context-aware execution runtime.

Execution model:

RUNBOOK + EXECUTION CONTEXT
↓
URI runtime
↓
scenario execution
↓
commands
↓
outbox
