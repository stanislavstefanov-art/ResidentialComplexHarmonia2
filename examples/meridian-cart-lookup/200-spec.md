# 200 Product Spec — Meridian Cart Lookup

## Scope

Build a point-of-sale cart lookup flow for associates. The associate verifies the customer, searches
for the active online cart, reviews item availability, and continues checkout in store.

## Acceptance criteria

1. Given a verified customer identity, when the associate searches for a cart, then the POS displays
   the active online cart if one exists.
2. Given a cart is found, when the cart loads, then each item displays quantity, price, and store
   stock status.
3. Given identity or cart lookup fails, when the associate continues, then the POS shows a fallback
   message and writes a lookup event.
4. The cart lookup response displays within 2 seconds for the representative training data set.

## Non-goals

- Payment changes.
- Loyalty enrollment changes.
- Cross-store inventory reservation.

## Open questions

- Who approves the exact identity verification method?
- Does the event log need to include a reason code taxonomy in the first release?

## Handoff to Design

Design the associate-facing lookup, review, and fallback states for the POS flow.
