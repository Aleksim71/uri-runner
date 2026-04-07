# test/real

Real truth-tests for the current watcher/audit pipeline.

Profiles currently covered:
- quick
- service_start
- db_query
- db_migration
- browser_action
- interactive_risk
- classification

Classification profile covers two pipeline truths:
1. `classification_required` for an unknown audit command.
2. `classification_response -> registry update -> rerun preflight -> execute`.
