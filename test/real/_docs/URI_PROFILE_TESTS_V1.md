# path: test/real/_docs/URI_PROFILE_TESTS_V1.md

# URI profile tests v1

## Wave 1

- `quick.success.basic`
- `quick.non_zero_exit`
- `interactive_risk.prompt_detected`
- `interactive_risk.no_retry_fail_fast`

## Wave 2

- `service_start.ready_success`
- `service_start.not_ready_timeout`
- `db_query.success`
- `db_query.retry_then_fail`

## Wave 3

- `db_migration.success`
- `db_migration.stall_detected`
- `browser_action.success`
- `browser_action.timeout_with_diagnostics`

## Normalized expected outbox format

```json
{
  "status": "success | failed | timeout | stalled | interactive_required",
  "attempts": 1,
  "profile": "quick",
  "stopReason": null,
  "artifacts": ["stdout.log"],
  "checks": {
    "exitCode": 0,
    "ready": true,
    "diagnostics": false
  }
}
```
