# BBQ Reservation Screen

**Status:** In Progress
**External Ticket:** (none)
**External Sync:** pending

## Goal

Build the BBQ reservation screen in both Angular (PrimeNG 22) and React (MUI v6).

## Acceptance Criteria

- User can select a day using a date picker
- Slot grid shows all slots for the selected day with visual states: free, taken-mine, taken-other
- User can claim a free slot; the UI calls POST /days/{day}/slots/{slotKey}/claim
- Feedback is shown for all claim outcomes: confirmed-yours (success), refused-already-taken (conflict), couldnt-confirm (error)
- Loading state shown while fetching slots
- Error state shown if API is unreachable, with retry
- Screen implemented identically in both Angular (ui/angular-prototype/) and React (ui/react-prototype/)
- Resident-only view — no admin role split required

## Linked Artifacts

- docs/superpowers/runs/20260716-1722-master/requirements.md

## History

- 2026-07-16T17:22:00Z — work item created from free-form input (sdlc-pipeline run 20260716-1722-master)
