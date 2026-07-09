# 500 Implementation Output — Meridian Cart Lookup

## Vertical slice

Implement one read-only cart lookup path:

1. Add POS frontend action `Cart lookup`.
2. Call POS backend endpoint `GET /pos/customers/{verifiedCustomerId}/active-cart`.
3. Backend requests active cart from commerce cart API.
4. Backend enriches items with store stock status.
5. Backend writes lookup audit event.
6. Frontend renders cart found, lookup failed, and timeout states.

## Likely changes

| Area | Change |
|------|--------|
| POS frontend | Lookup action, loading state, cart table, fallback message |
| POS backend | Cart lookup controller, commerce API client wrapper, timeout handling |
| Test fixtures | Representative cart, empty cart, unavailable item, timeout |
| Audit adapter | Lookup attempt event with result and reason code |

## Verification hooks

- Unit tests for response mapping and timeout fallback.
- Contract test for commerce cart response shape.
- Integration test for cart found, empty cart, and service timeout.
- Audit event assertion for success and failure.

## Open assumptions

- Identity verification is completed before this endpoint is called.
- Reason-code taxonomy is approved before production-like use.

## Handoff to Infra/Ops, Security, QA

Infra/Ops needs timeout and logging requirements. Security needs identity boundary and audit fields.
QA needs fixtures and explicit reason-code behavior.
