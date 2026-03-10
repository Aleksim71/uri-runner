# uri-runner (CLI: `uri`) — minimal skeleton

This is a **minimal, test-first** starting point for the `uri-runner` project.

- npm package name: **uri-runner**
- CLI binary: **uri**
- Node: >= 18 (recommended 22)

## What works in this skeleton (step 4)
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

## Checks (runbook)
Add optional checks to RUNBOOK.yaml:

```yaml
version: 1
audit:
  checks:
    - name: test
      cmd: npm
      args: ["test"]
```

## Server lifecycle (runbook)

```yaml
version: 1
audit:
  server:
    cmd: node
    args: ["path/to/server.cjs"]
    base_url: "http://127.0.0.1:3000"
    readiness:
      type: http
      path: "/health"
      timeout_ms: 8000
      interval_ms: 200
```

## URL checks (public)

```yaml
version: 1
audit:
  urls:
    expect: [200, 304]
    public:
      base_url: "http://127.0.0.1:3000"
      list:
        - path: "/"
        - path: "/catalog"
```

Auth format reserved for Step7:

```yaml
audit:
  urls:
    auth:
      base_url: "http://127.0.0.1:3000"
      login:
        type: form
        path: /login
        method: POST
        fields:
          email: test@example.com
          password: testpass
      list:
        - path: /cabinet
```
