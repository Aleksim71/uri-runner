# URI Protocol

## Execution contract

URI is a controlled execution runtime.

### Required behavior

- accept only valid runbooks addressed to `uri`
- stop on unknown or unregistered commands
- generate report artifacts even on failure
- attach operator instructions when classification is required

## Failure mode

If execution cannot continue safely, URI must still finish the cycle:

1. stop execution
2. produce report
3. include status/error details
4. include guidance in `REPORT/instructions/`
