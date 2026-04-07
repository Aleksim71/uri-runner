# Testing Strategy (Piligrim Rule)

**Source of truth:**
```
inbox.zip → URI → outbox.zip → compare with expected
```

A feature is considered ready only if it passes a real inbox→outbox test and produces correct artifacts.

- Truth tests (P0): required
- Unit/contract tests (P1): supportive only

> Truth > Unit
> Works in reality > looks correct in code
