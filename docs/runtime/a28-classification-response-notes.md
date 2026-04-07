# A28.1d — classification response apply + rerun preflight

What this step adds:
- `CLASSIFICATION_RESPONSE.yaml|yml|json` can be placed next to `RUNBOOK.yaml` in inbox.
- Audit runtime applies the response to the command registry before preflight.
- After applying, audit reruns preflight against the updated registry.
- If preflight now passes, audit executes the checks/server flow normally.
- If the response is invalid, audit returns a dedicated non-zero exit code.

Current response schema (MVP):
```yaml
version: 1
commands:
  - id: shell.bash.inline
    group: shell
    profile: instant
    match:
      cmd: bash
      args_prefix:
        - -lc
```

Notes:
- This MVP mutates the target registry file directly.
- Real tests keep this isolated by using a temporary repo copy with a case-local executable context.
