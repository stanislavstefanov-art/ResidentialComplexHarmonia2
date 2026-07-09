# 400 Architecture Output — Meridian Cart Lookup

## Architecture decision

Use a thin POS backend endpoint that requests the active online cart from the commerce API after
the POS flow confirms customer identity verification. The POS frontend does not call the commerce
cart service directly.

## Components touched

| Component | Role in this slice |
|-----------|--------------------|
| POS frontend | Adds cart lookup entry point, cart review state, fallback state |
| POS backend | Owns cart lookup request, timeout, audit event |
| Commerce cart API | Read-only source for active online cart |
| Inventory service | Read-only stock status lookup |
| Audit log | Stores lookup attempt, result, reason code, timestamp |

## Non-functional bounds

- Target response: under 2 seconds for the representative training data set.
- Timeout: POS backend stops waiting after 1.5 seconds and returns fallback state.
- No payment, loyalty, or inventory reservation changes in this slice.

## Seam note

Design asked for source systems, API owner, data sensitivity classification, and audit-event
requirements. Product and Design did not carry those forward. Architecture filled a safe training
assumption and recorded this as an under-supply seam.

## Handoff to Engineering, Data, Infra/Ops, Security, QA

- Engineering implements the thin backend endpoint and POS frontend states.
- Data defines audit event fields and retention/classification questions.
- Infra/Ops sets timeout, logging, alerting, and rollback.
- Security reviews identity verification, audit event exposure, and POS trust boundary.
- QA tests happy path, fallback path, timeout, audit event, and reason-code visibility.
