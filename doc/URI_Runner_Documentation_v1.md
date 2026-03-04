# URI Runner (uri-runner) — Documentation v1

Date: 2026-03-04  
Owner workflow: **Макс ⇄ URI Runner ⇄ Алекс**  
npm package: **uri-runner**  
CLI command: **uri**

---

## 0) Purpose

**URI Runner** is a local automation tool that reduces routine in the development workflow by standardizing:

- Project diagnostics (system + git + tree)
- Tests/build execution and log collection
- Web checks (URLs, auth access checks, browser screenshots, DevTools-like captures)
- DB probe (read-only)
- Controlled file changes via `PATCHES/` and `REPLACE/`
- Artifact exchange via `inbox.zip → outbox.zip`

---

## 1) High-level Workflow

### 1.1 Old workflow
- Алекс manually copies logs/files/screenshots into chat.
- Макс requests more details iteratively.

### 1.2 New workflow (recommended)
1. Алекс prepares `artifacts/inbox/inbox.zip`
2. Алекс runs:
   - `uri` (defaults to `audit`)
3. URI Runner produces:
   - `artifacts/outbox/outbox.zip`
4. Алекс shares outbox with Макс
5. Макс analyzes and may return a new inbox (patch/replace + requests)
6. Repeat

---

## 2) Execution Modes

### 2.1 `audit` (read-only, default)
Goal: diagnose and verify without changing project files.

- No PATCHES/REPLACE apply
- No commit/push
- Writes only to workspace + outbox artifacts

Run:
```bash
uri
# or
uri audit
```

### 2.2 `patch` (mutating working tree)
Goal: apply changes and immediately verify.

- Applies `PATCHES/` and/or `REPLACE/`
- Leaves changes in working tree (no commit/push)
- Always exports resulting `git diff` into outbox

Run:
```bash
uri patch
```

### 2.3 `attach` (server already running)
Goal: verify a running server without starting/stopping it.

- No server start
- No port cleanup
- Runs readiness/urls/auth/browser checks against given base URL

Run:
```bash
uri attach --base-url http://127.0.0.1:3000
```

---

## 3) Inputs and Outputs

### 3.1 Inbox contract (`inbox.zip`)
Recommended structure:
```
inbox.zip
├─ RUNBOOK.yaml
├─ NOTES/                (optional)
├─ REQUEST_FILES.txt     (optional)
├─ PATCHES/              (optional, patch profile)
└─ REPLACE/              (optional, patch profile)
   └─ REPLACE_MANIFEST.json
```

### 3.2 Outbox contract (`outbox.zip`)
```
outbox.zip
├─ SNAPSHOT.txt
├─ STATUS.json
├─ REPORT/
├─ DIFF/
├─ FILES/
└─ ARTIFACTS/
```

Required files:
- `SNAPSHOT.txt` — human summary
- `STATUS.json` — machine-readable outcome and step status

---

## 4) Project Configuration

### 4.1 `project.audit.json` (project-side config)
Purpose: stable “sources of truth” for runner in a given project.

Recommended location:
- `<repo_root>/project.audit.json`

Key sections:
- `execution.mode`: `native` or `docker`
- `server`: start cmd + readiness strategy
- `urls`: manifest file
- `checks`: tests/build commands
- `db`: read-only probe settings
- `auto_context`: files/paths to export automatically
- `browser`: screenshots + console/network capture
- `devtools_capture`: HAR/DOM/performance/trace flags

### 4.2 `project.urls.json` (manual URL registry)
Purpose: explicit list of pages to verify.

Supports public/private and expected behaviors:
- `public: true` (expect 200 for guest and user)
- `auth_required: true` (guest expect 302/401/403, user expect 200)

Example:
```json
{
  "base": "http://127.0.0.1:3000",
  "urls": [
    { "path": "/", "public": true },
    { "path": "/catalog", "public": true },
    { "path": "/login", "public": true },
    { "path": "/cabinet", "auth_required": true }
  ]
}
```

---

## 5) Server Readiness (Start Verification)

Runner supports three readiness strategies (choose one in config):

1. **HTTP** (recommended): poll `/health` (fallback `/`)
2. **STDOUT**: wait for a fixed marker line, e.g. `READY`
3. **FILE**: wait until file exists, e.g. `.runner-ready`

Notes:
- Readiness via “child changes parent env” is **not possible** (process env isolation).

---

## 6) URL Checks

For each URL path:
1. `GET` and validate expected status (usually 200)
2. Optional cache check:
   - if response contains `ETag` or `Last-Modified`, re-request with `If-None-Match` / `If-Modified-Since` and expect **304**
   - if missing headers → not a failure; record `missing_headers`

Outputs:
- `REPORT/urls.json`

---

## 7) Auth Access Checks (Guest vs User)

Runner can check access in two states:

- **guest**: without login
- **user**: after login (test credentials)

Rules:
- Public pages: guest 200, user 200
- Private pages: guest 302/401/403, user 200

Credentials:
- **Never stored in repo**. Only via env:
  - `AUDIT_TEST_USER`
  - `AUDIT_TEST_PASS`

Security:
- no credentials in outbox logs
- no cookies/storage state exported to outbox

Outputs:
- `REPORT/auth_access.json`
- optional screenshots under `ARTIFACTS/screenshots/(guest|user)/`

---

## 8) Browser Checks (Playwright)

When enabled, runner can:
- open pages
- take screenshots
- capture console + page errors
- capture network failures

Outputs:
- `ARTIFACTS/screenshots/...`
- `REPORT/browser.console.(guest|user).jsonl`
- `REPORT/browser.pageerrors.(guest|user).jsonl`
- `REPORT/browser.network.(guest|user).jsonl`
- `REPORT/browser.summary.json`

---

## 9) DevTools-like Captures (CDP via Playwright)

Optional captures:
- `network.har`
- DOM snapshot (rendered HTML)
- performance timing metrics
- trace (large; off by default)

Outputs:
- `ARTIFACTS/network.har` (optional)
- `ARTIFACTS/dom/<page>.html` (optional)
- `REPORT/performance.json` (optional)
- `ARTIFACTS/trace/trace.zip` (optional)

---

## 10) DB Probe (Read-only)

Goal: collect DB availability + basic schema metadata.

- Source DSN: env (default `DATABASE_URL`), configurable by `url_env`
- **SELECT-only** (no migrations, no seeds)

Minimum queries:
- `SELECT 1`
- `SELECT version()`
- `SELECT current_database()`, `SELECT current_schema()`
- list tables from `information_schema`

Migration table detection:
- check known candidates (configurable)
- if not found, still scan repo migration folders

Outputs:
- `REPORT/db.summary.json`
- `REPORT/db.tables.json`
- `REPORT/db.migrations.files.txt`

---

## 11) Project Tree Snapshot

Default method: `git ls-files` (stable and excludes ignored files).

Output:
- `REPORT/tree.txt`

---

## 12) Logs + Diff Collection

Runner collects:
- logs per step: `REPORT/checks.<name>.out.log`, `REPORT/checks.<name>.err.log`
- server stdout/stderr logs
- crash summary (tail) on failures
- git status/log snapshots
- git diff patch

Outputs:
- `REPORT/git.status.txt`, `REPORT/git.log.txt`
- `DIFF/changes.patch` (if changes exist)
- `REPORT/crash_summary.txt` (on failure)

---

## 13) File Export

### 13.1 Auto Context Export
Runner can export a curated set of “always useful” files defined in config.

Outputs:
- `FILES/auto/...`
- `FILES_AUTO_INDEX.json`

### 13.2 Requested Files Dump
By `REQUEST_FILES.txt` (one path per line):
- exports to `FILES/<path>`
- writes `FILES_INDEX.json`

Security:
- deny-list for `.env`, keys, `.git`, `node_modules`, builds, uploads
- max size per file (default 200 KB)

---

## 14) Patch/Replace — File Modification Inputs

### 14.1 PATCHES (unified diff)
Inbox structure:
```
PATCHES/
  001-*.patch
  002-*.patch
```
Applied in alphabetical order.

### 14.2 REPLACE (full file replacement)
Inbox structure:
```
REPLACE/
  <files mirrored by path>
  REPLACE_MANIFEST.json
```

Manifest example:
```json
{
  "replace": [
    { "src": "REPLACE/src/web/routes/web.routes.js", "dst": "src/web/routes/web.routes.js" }
  ]
}
```

Priority if both exist:
1) PATCHES
2) REPLACE

Runner never commits/pushes.

---

## 15) Exit Codes (standardized)

- `0` OK
- `10` inbox unreadable / missing
- `11` missing RUNBOOK.yaml
- `12` invalid runbook schema/version
- `20` infra failure (git/node/workspace)
- `30` checks failed (tests/build)
- `40` server failed to start
- `41` readiness failed/timeout
- `50` URL/auth checks failed

---

## 16) Execution: native vs docker

### 16.1 native (default)
Runs directly in repo on host machine.

### 16.2 docker (optional)
Runs inside container with mounted repo + artifacts.
Useful for reproducibility; may require DB networking config.

Priority of mode selection:
1) CLI
2) RUNBOOK.yaml
3) project.audit.json
4) default = native

---

## 17) Security Rules (hard requirements)

Runner must not export:
- `.env`, `.env.*`
- `**/*.pem`, `**/*.key`, `id_rsa*`
- `.git/**`
- `node_modules/**`, `dist/**`, `build/**`, `coverage/**`, `uploads/**`

Runner must not:
- commit
- push
- write credentials into logs/outbox
- export cookies/storageState

---

## 18) Technical Debt

- Automatic URL discovery (crawl/sitemap/router scan)
- Patch dry-run validation (`git apply --check`)
- Advanced profiling (heap/memory), large tracing

---

## 19) Testing Strategy (uri-runner project)

### 19.1 Unit tests
- runbook parsing/validation
- config parsing
- deny-list and path traversal prevention
- file size/binary detection
- STATUS/SNAPSHOT formatting

### 19.2 Integration tests (key)
- create temp git repo
- run audit producing outbox and required files
- url checks against a fake local server
- readiness strategies (http/stdout/file)
- browser capture (optional; separate suite)
- patch apply and replace flows

---

## 20) Publishing (npm)

- Repo: GitHub `uri-runner`
- Package: `uri-runner`
- Binary: `uri` via `package.json` `bin`

SemVer:
- `0.x` while contracts evolve
- `1.0.0` once inbox/outbox are stable

---

## Appendix A — Minimal Tempasi integration checklist (v1)

Add to Tempasi repo:
- `project.audit.json`
- `project.urls.json`
- `artifacts/inbox/inbox.zip` (input)
- `artifacts/outbox/` (output folder)

Recommended:
- npm script `"uri": "uri audit"`

Install runner:
```bash
npm i -g uri-runner
# or (project pinned)
npm i -D uri-runner
```

Run:
```bash
uri
```
