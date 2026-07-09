# 100 Opportunity Brief — Meridian Cart Lookup

## Trigger

Store associates report that customers arrive with an online basket but abandon the in-store
checkout when the associate has to rebuild the cart manually.

## User and moment

- **User:** store associate at the point of sale.
- **Customer moment:** customer wants to complete an online cart in store.
- **Business result:** reduce basket rebuild time and prevent lost mixed-channel purchases.

## Desired outcome

The associate retrieves the customer's online cart after identity verification, reviews item and
stock status, and moves eligible items into the POS checkout flow.

## Constraints

- Use a representative training case. Do not use real customer names, emails, tokens, or order IDs.
- The flow needs a visible fallback when identity or cart lookup fails.
- The line should capture audit events for lookup failures.

## Handoff to Product / BA

Turn this into a thin feature spec with acceptance criteria, non-goals, and open questions for the
team bootcamp.
