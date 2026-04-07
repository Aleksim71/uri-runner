# path: test/real/fixtures/runbooks/AUDIT_RUNBOOK_TEMPLATE.md

Ниже — минимальный shape, под который собраны case templates:

```yaml
version: 1
project: uri-real-tests
profile: audit
cwd: __WORKSPACE__
audit:
  checks:
    - name: smoke
      run: node -e "console.log('ok')"
```

Если в проекте точная схема `RUNBOOK.yaml` уже изменилась, подправлять нужно только содержимое `cases/*/INBOX/RUNBOOK.yaml`.
