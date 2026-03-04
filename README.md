# uri-runner (CLI: `uri`) — minimal skeleton

This is a **minimal, test-first** starting point for the `uri-runner` project.

- npm package name: **uri-runner**
- CLI binary: **uri**
- Node: >= 18 (recommended 22)

## What works in this skeleton (step 2)
- `uri` / `uri audit`:
  - writes REPORT/system.json, REPORT/git.json, REPORT/tree.txt
  - reads `artifacts/inbox/inbox.zip` (default)
  - extracts it into `.runner-work/<runId>/inbox/`
  - validates `RUNBOOK.yaml` (expects `version: 1`)
  - produces `artifacts/outbox/outbox.zip` containing:
    - `SNAPSHOT.txt`
    - `STATUS.json`
    - `REPORT/runbook.json`

## Quick start

```bash
npm i
npm test
```

## CLI

```bash
# default audit
node src/cli.cjs

# explicit
node src/cli.cjs audit

# custom paths
node src/cli.cjs audit --inbox ./artifacts/inbox/inbox.zip --outbox ./artifacts/outbox/outbox.zip
```

## Next steps
Incrementally implement:
- git snapshot + tree
- checks (tests/build)
- server start + readiness
- urls + auth checks
- browser capture (Playwright)
- db probe
- patch/replace profiles
