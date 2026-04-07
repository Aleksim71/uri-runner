# path: test/real/_docs/URI_COMMANDS_V1.md

# URI commands v1 — minimally sufficient set

## Terminal / shell

- `pwd` -> `quick`
- `node -v` -> `quick`
- `git status` -> `quick`
- `npm test` -> `long_task` (phase 2)
- `npm run dev` -> `service_start`

## Database

- `psql -c "select 1"` -> `db_query`
- `npm run migrate` -> `db_migration`

## Browser / devtools transport

- browser helper start -> `browser_session_start` (phase 2)
- open page / wait / screenshot -> `browser_action`

## Guarded

- `rm ...` -> `destructive_guarded` (phase 2)
- reset / overwrite -> `destructive_guarded` (phase 2)

## First-stage focus

Для первой волны real tests достаточно покрыть:

- `quick`
- `service_start`
- `db_query`
- `db_migration`
- `browser_action`
- `interactive_risk`
