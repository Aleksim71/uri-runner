Executable Context Runtime Patch
URI Runner Next


------------------------------------------------
Idea
------------------------------------------------

contexts/system/executable.yaml

is the executable context describing
how the project should run.


------------------------------------------------
Why this exists
------------------------------------------------

RUNBOOK.yaml from inbox.zip does not store task history.

Git stores the history of executable.yaml.

Therefore:

context + command history
are preserved in git.


------------------------------------------------
Structure
------------------------------------------------

contexts/
  system/
    executable.yaml


------------------------------------------------
Example executable.yaml
------------------------------------------------

version: 1

meta:
  context_kind: executable_context
  context_id: system_executable
  project: uri-runner-next
  status: active

runtime:

  environment:
    reset_before_run: true

    startup:
      command: "npm run start"

      healthcheck:
        type: http_ok
        url: "http://localhost:3000/health"
        timeoutSec: 10


scenario:
  start: step1

steps:

  - id: step1
    command: system.echo
    args:
      message: hello
    on_success: step2

  - id: step2
    command: system.echo
    args:
      message: done
    stop: true


------------------------------------------------
Execution Lifecycle
------------------------------------------------

AI writes executable.yaml

URI:

1 reads executable.yaml
2 compiles scenario plan
3 resets runtime environment if configured
4 executes scenario
5 records execution trace
6 produces outbox artifact


------------------------------------------------
After execution
------------------------------------------------

version: 1

meta:
  context_kind: executable_context
  context_id: system_executable
  status: executed
  last_run_id: RUN_ID
  last_run_ok: true
  last_engine: scenario


------------------------------------------------
Security
------------------------------------------------

AI does not have direct filesystem access.

URI controls:

cwd
paths
workspace
runtime directories


------------------------------------------------
Future direction
------------------------------------------------

URI will be able to execute executable.yaml
even without inbox.zip.

Command:

uri run

will check:

contexts/system/executable.yaml

and execute it directly.


------------------------------------------------
END
------------------------------------------------
