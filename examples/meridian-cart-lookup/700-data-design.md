# 700 Data Design Output — Meridian Cart Lookup

## Data contract

| Field | Source | Use | Sensitivity |
|-------|--------|-----|-------------|
| verifiedCustomerId | POS identity flow | cart lookup key | customer identifier |
| cartId | commerce cart API | cart retrieval and audit correlation | customer-linked |
| sku | commerce cart API | item display and stock lookup | product data |
| quantity | commerce cart API | checkout review | order intent |
| stockStatus | inventory service | associate decision support | operational |
| lookupResult | POS backend | audit event | operational |
| reasonCode | POS backend | failure audit and support | operational, policy-reviewed |

## Quality checks

- Cart response has cart ID, at least zero items, and timestamp.
- Item rows include SKU, quantity, price, and stock status.
- Lookup event writes on success, empty cart, identity failure, cart API timeout, and unexpected
  error.
- Reason code belongs to approved taxonomy before use outside training.

## Retention and classification

Training run uses synthetic data. A real repository needs owner approval for retention period,
reason-code visibility, and whether cart ID plus customer ID is treated as restricted customer data.

## Handoff to Infra/Ops, Security, QA

Infra/Ops needs logging volume and retention. Security needs data sensitivity and exposure points.
QA needs fixtures for every lookup result and reason code.
