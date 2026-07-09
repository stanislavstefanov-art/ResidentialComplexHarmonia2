# 800 Infra/Ops Output — Meridian Cart Lookup

## Runtime plan

- Deploy behind the existing POS backend release path.
- Keep the cart lookup endpoint read-only.
- Set a 1.5 second backend timeout for commerce cart API and stock lookup fan-out.
- Return fallback state when the timeout fires.
- Disable the feature with a configuration flag.

## Observability

| Signal | Purpose |
|--------|---------|
| lookup latency p50/p95 | confirm the 2 second user-facing target |
| lookup result count by reason code | spot identity and cart API failures |
| timeout count | detect upstream dependency health |
| audit write failure count | block release if logging fails |

## Cost guardrails

This run uses one feature, one pass per station, and synthetic artefacts. No background agents,
parallel autonomous workers, or production telemetry access are required.

## Rollback

Turn off the feature flag and leave backend endpoint inactive. No database migration is part of
this slice.

## Handoff to Security, QA, Management / Delivery

Security reviews audit-event sensitivity and trust boundaries. QA verifies timeout/fallback,
observability, and rollback. Management / Delivery needs release gates and owner approvals.
