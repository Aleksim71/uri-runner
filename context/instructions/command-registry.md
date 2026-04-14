# Command Registry

## Purpose

This instruction is used when URI stops with an unknown or unregistered command.

## Rule

A command may be executed only if it is registered and classified before execution.

If a scenario contains an unknown command, URI must:

1. stop before execution
2. mark the run as `classification_required`
3. prepare a report
4. include these instructions in `REPORT/instructions/`

## What Max should do

When you see `classification_required` or `UNKNOWN_COMMAND`:

1. inspect the scenario step that failed
2. determine whether the command is:
   - a typo
   - missing from registry
   - not allowed by current execution contract
3. either:
   - fix the scenario to use an already registered command
   - or register/classify the command properly before retry

## Minimal guidance

Registered commands must be explicit.
Implicit execution is forbidden.
Unknown commands must never reach runtime execution.
