# 900 Security Review — Meridian Cart Lookup

## Trust boundaries

| Boundary | Risk |
|----------|------|
| POS associate session to POS backend | associate could query a cart without approved verification |
| POS backend to commerce cart API | customer-linked cart data crosses service boundary |
| POS backend to audit log | failure reason codes may expose sensitive details |

## Top risks and mitigations

1. **Unauthorized cart lookup.** Require verified identity state before the endpoint runs; log every
   attempt.
2. **Sensitive reason-code exposure.** Keep detailed reason code in audit log; show only approved
   associate-facing messages.
3. **Over-broad audit payload.** Do not store cart contents in the audit event; store cart ID,
   result, reason code, timestamp, and associate/session reference.

## Required checks before pilot

- Verify identity-state enforcement in backend tests.
- Verify audit event writes for success and failure.
- Review reason-code taxonomy with product and compliance owner.
- Confirm synthetic training data remains synthetic.

## Residual human decisions

- Who approves the identity verification method?
- Which reason codes may be visible to associates?
- What is the retention period for cart lookup audit events?

## Handoff to QA and Management / Delivery

QA must test identity enforcement, audit event shape, timeout fallback, and visible reason-code
policy. Management / Delivery must record the two approval gates before pilot.
