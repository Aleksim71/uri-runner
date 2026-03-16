URI Runner
Environment Reset System


Purpose

Environment Reset ensures that scenario execution
starts in a deterministic environment state.

It prevents contamination between runs.


Execution Trigger

Environment reset executes when:

runtime.environment.reset_before_run = true


Reset Pipeline

1 stop managed processes

Terminate processes started by previous runs.

2 cleanup runtime state

Remove temporary runtime artifacts.

3 start managed server

Launch project server defined in runtime policy.

4 run healthcheck

Verify that the server is reachable and ready.


Cleanup Rules

cleanup-runtime-state removes temporary runtime artifacts:

*.pid  
*.lock  
*.tmp  

Temporary runtime directories:

tmp  
.runtime-tmp  
.uri-tmp  


Selective Cleanup

Runtime may also perform targeted cleanup of run sandbox
temporary directories such as:

runtime/runs/<runId>/tmp


Healthcheck Types


http_ok

Checks HTTP endpoint.

Example:

type: http_ok
url: http://localhost:3000/health


process_alive

Checks if process with specific PID exists.


Failure Handling

If environment reset fails:

scenario execution is aborted  
run is marked as failed  
error is reported in outbox  


Location in Execution Lifecycle

Environment Reset runs after:

Plan Compile  
Run Sandbox Initialization  

and before:

Scenario Execution
