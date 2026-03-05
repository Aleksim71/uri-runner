# URAM Protocol v1 (Watcher rules)

## Incoming ZIPs
Watcher monitors `~/Загрузки` by default.

A ZIP is treated as an URAM package **only if it contains `META.json`**:

- **No `META.json`** → watcher **ignores** the ZIP and leaves it in Downloads.
- **Damaged `META.json`** (present, but invalid JSON or missing required fields) → watcher:
  - moves ZIP to `~/uram/patchpacks/_unknown/`
  - writes an error `outbox.latest.zip` into `~/uram/uri-runnerBox/` (so you can send it back to Макс).

## META.json minimal schema
Required fields:
- `version`: `1`
- `kind`: `"info"` or `"patch"`
- `project`: `<project-name>`

## Routing (when META is valid)
- `kind=patch` → `~/uram/patchpacks/<project>/...`
- `kind=info`  → `~/uram/Inbox/inbox.zip` and watcher runs `uri run`
