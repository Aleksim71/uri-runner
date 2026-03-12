URI Runner v2 Completion Criteria

Goal of v2

Deliver a working context-aware runtime that can:

read RUNBOOK.yaml from inbox.zip

resolve project through config/projects.yaml

load execution policy from contexts/system/executable.yaml

execute scenario steps through command registry

finalize outbox/history/latest/processed flow

fail predictably on invalid runtime cases


Functional Scope

Included in v2

uri run

inbox processing

runbook parsing and validation

project resolution

executable context loading

scenario engine

audit engine

command loading

execution locking

outbox finalization

runtime smoke test

negative runtime test


Not part of v2

workflow engine

nested scenarios

context graph resolution

distributed execution

parallel step execution

advanced retry policies


Required Contracts

RUNBOOK contract

version: 1
project: demo
steps:
  - id: step_echo_1
    command: system.echo
    args:
      message: "hello"

Status: DONE


Scenario step contract

Required fields:

id
command
args

Example:

- id: step_echo_1
  command: system.echo
  args:
    message: "hello"

Status: DONE


Project resolution contract

File:

config/projects.yaml

Example:

version: 1
projects:
  demo:
    cwd: /absolute/path/to/project

Status: DONE


Executable context contract

File:

contexts/system/executable.yaml

Example:

version: 1

engine: scenario

commands:
  roots:
    - system
    - project

runtime:
  max_steps: 100
  strict_commands: true

Status: DONE


Runtime Behavior Criteria

Happy-path execution

Runtime must:

read RUNBOOK.yaml

resolve project

load executable context

load commands

parse scenario

execute scenario

write outbox

move inbox to processed

Status: DONE

Confirmed by test:

test/scenarios/scenario-runtime.smoke.test.mjs


Unknown command handling

Runtime must fail on unknown command when strict mode is enabled.

Status: DONE

Confirmed by test:

test/scenarios/scenario-runtime.unknown-command.test.mjs


Execution lock

Runtime protects project execution with a lock.

Status: DONE


Outbox finalization

Runtime maintains:

latest outbox

history outboxes

processed inbox

history index

Status: DONE


Engine Criteria

Scenario engine

loads commands

parses runbook steps

executes steps sequentially

returns structured result

Status: DONE


Audit engine

runs audit profile

integrates with runtime pipeline

Status: DONE


Architecture Criteria

Runtime layering

run.cjs
↓
pipeline.cjs
↓
runbook.cjs
↓
engine
↓
scenario parser / executor
↓
commands

Status: DONE


Context-aware execution

Runtime depends on:

RUNBOOK.yaml
contexts/system/executable.yaml

Status: DONE


Test Criteria

Minimum required tests

scenario smoke test
unknown command negative test

Status: DONE


Definition of Done

URI Runtime v2 is considered complete when:

scenario execution works end-to-end

executable context participates in runtime

command resolution is tested

unknown command failure is tested

outbox/history/processed flow works

runtime contracts are documented


Current status

V2 CORE FUNCTIONAL DONE
