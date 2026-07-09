# 300 Design Output — Meridian Cart Lookup

## Flow

1. Associate opens **Cart lookup** from the POS checkout screen.
2. Associate confirms the customer identity verification has completed.
3. Associate searches for the active online cart.
4. POS displays cart items with quantity, price, and store stock status.
5. Associate selects eligible items and continues checkout.

## Screen notes

| State | UI treatment |
|-------|--------------|
| Search ready | Search field, verification status, disabled continue button |
| Cart found | Item table with stock badges and checkout action |
| Lookup failed | Inline failure message, retry action, manual basket fallback |

## Seam note

The Product spec names a fallback message but does not define the empty-state copy, accessibility
requirements, or which lookup failure reasons the associate can see. Design drafted a minimal
fallback, but the team should harden the Product -> Design handoff before implementation.

## Handoff to Architecture

Architecture needs the source systems, API owner, data sensitivity classification, and audit-event
requirements before it can choose the integration shape.
