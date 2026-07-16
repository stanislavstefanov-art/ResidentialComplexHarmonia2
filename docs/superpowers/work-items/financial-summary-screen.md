# Work Item — financial-summary-screen

**Status**: In Progress
**Branch**: TBD (feat/financial-summary-screen)
**External Ticket**: none
**External Sync**: pending

## Goal

Build the financial summary screen in both Angular (PrimeNG 22) and React (MUI 9) prototypes, showing the resident's current balance, itemised charges, and payment history, with a Pay button stub.

## Acceptance Criteria

- Display current balance (from GET /financial-summary)
- Display list of charges with date, description, amount
- Display list of payments with date and amount
- "Pay" button calls POST /payments with a user-entered amount
- Same feature delivered in ui/angular-prototype/ and ui/react-prototype/
- Resident-only view (no admin split)

## Linked Artifacts

- docs/superpowers/runs/20260716-1851-master/requirements.md

## History

- 2026-07-16T18:52:30Z — work item created by requirements-intake (free-form funnel); external sync pending
