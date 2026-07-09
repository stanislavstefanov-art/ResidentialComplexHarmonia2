# 600 QA Test Plan — Meridian Cart Lookup

## Test scope

QA reads the spec, implementation plan, data contract, infra plan, and security review. The test
plan covers behavior, data, security, operations, and release readiness.

## Tests

| Area | Test | Evidence |
|------|------|----------|
| Happy path | verified customer with active cart displays items and stock in under 2 seconds | integration test |
| Empty cart | verified customer with no active cart sees fallback message | UI/integration test |
| Timeout | commerce API timeout returns fallback and logs event | integration test |
| Identity enforcement | unverified lookup is rejected before commerce API call | backend test |
| Audit event | success and failure write approved fields | unit/integration test |
| Observability | latency, result count, timeout count, audit failure count are emitted | local log check |
| Rollback | feature flag disables lookup entry point | smoke test |

## Seam note

Security defined the safe audit shape but did not give QA an approved visible reason-code policy.
QA can test "no sensitive reason shown" but cannot certify associate-facing copy until Product,
Security, and compliance approve the taxonomy.

## Handoff to Management / Delivery

Delivery needs the test evidence, unresolved human gates, and the first seam to harden before the
team bootcamp pilot.
