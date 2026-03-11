# URI Runtime Execution Model (v2)

This document describes how URI executes scenarios.

## Execution Flow
uri run
↓
RUNBOOK.yaml
↓
URAM runtime
↓
scenario parser
↓
scenario executor
↓
command registry
↓
commands


## Scenario Step Contract

Each step in a scenario must follow a unified structure.

Example:

```yaml
steps:
  - type: command
    name: system.echo
    args:
      message: "hello"
      | field | description               |
| ----- | ------------------------- |
| type  | step type (v2: `command`) |
| name  | command identifier        |
| args  | command arguments object  |

Executor Logic

The executor processes steps sequentially.

Pseudo flow:


for step in scenario.steps
validate(step)
dispatch(step.type)


Supported step types in v2:

command
Command Execution

Command steps call commands from the command registry.

commandRegistry.get(step.name)

The command receives:

args
runtime context
Runtime Context

Commands receive runtime context containing:

commandRegistry
runbook
runtime
logger

This contract defines the stable interface between:

scenario parser

scenario executor

command registry

commands


---

# После этого

Сделай маленький коммит:

```bash
git add doc/runtime/execution-model.md
git commit -m "docs(runtime): add execution model specification"

      
