# Work Item: Admin Charge Dashboard

**Status**: In Progress
**Slug**: admin-charge-dashboard
**External Ticket**: none
**External Sync**: pending

## Goal

Admin-only endpoint that lists all maintenance fee charges across every household, ordered by household then by charge date descending.

## Acceptance Criteria

- [ ] `GET /maintenance-fees/charges/all` returns all charges across all households when called by an admin session.
- [ ] Response is ordered by `HouseholdRef` ascending, then `ChargedAt` descending within each household.
- [ ] A non-admin (resident or no session) receives HTTP 403.
- [ ] New use case `ListAllCharges` in `Harmonia.Application.MaintenanceFees` — admin guard, no household filter.
- [ ] New SQL adapter method `ListAllChargesAsync` in `SqlMaintenanceFeeStore` — single `SELECT … ORDER BY HouseholdRef ASC, ChargedAt DESC`.
- [ ] R3: `HouseholdRef` values never appear in log lines.
- [ ] Unit tests: admin allowed, non-admin refused, no-session refused, log exclusion.
- [ ] Integration test (Rel tier): real SQL Server, verifies ordering and cross-household aggregation.

## Out of Scope

- Pagination (deferred).
- Filtering by date range or household (deferred).
- Resident access to the all-charges view (residents use `GET /maintenance-fees/charges` for their own household only).

## Open Questions

(none)

## Linked Artifacts

- `docs/superpowers/runs/20260712-1016-master/requirements.md`

## History

- 2026-07-12T10:16:00Z — created from free-form input in run 20260712-1016-master
