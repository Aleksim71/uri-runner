# URI Testing Strategy — Piligrim Rule

## Main principle
System is considered working only if it passes:
inbox.zip → URI → outbox.zip → compare with expected

## P0: Truth tests
- Build inbox.zip
- Run URI
- Validate outbox.zip
- Check artifacts and structure

## Readiness criteria
- Truth test passes
- Artifacts exist
- Output matches expected

## P1: Unit tests
- Optional
- Help debugging
- Not proof of correctness

## Anti-pattern
Green tests but system doesn't work → missing truth tests

## Rule
If no inbox→outbox test — feature is not done.
