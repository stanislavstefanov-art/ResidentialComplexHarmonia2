# ADR-0004 — HouseholdContacts Retention and Departure Marker

**Status:** Accepted
**Closes:** GATE-DATA-1 (gap-log.md #2) — retention period and departure signal for dbo.HouseholdContacts
**Date:** 2026-07-16

## Context

PR #10 introduced `dbo.HouseholdContacts`, which stores personal data (`DisplayName`,
`Phone`, `Email`, `Notes`) for residents. PR #11 delivered the GDPR Art. 17 erasure
core (on-demand hard DELETE). What remained open was:

1. **How long** personal data is retained after a resident leaves the complex.
2. **What event** signals departure (the "DepartedAt" trigger).
3. **What lawful basis** justifies retention beyond the resident's stay.
4. **How** expired rows are purged in bulk (the `PurgeExpiredContacts` sweep, deferred
   from erasure Slice 1).

These questions were recorded as GATE-DATA-1 in the gap log and required a board
decision before retention enforcement could be engineered.

## Decision

### Retention period

Personal data in `dbo.HouseholdContacts` is retained for **1 year** after `DepartedAt`
is set. After that period a hard `DELETE` applies — identical to the Art. 17 on-demand
erasure already shipped.

### Departure marker

`DepartedAt` (nullable `datetimeoffset`) is a new column on `dbo.HouseholdContacts`.
A board admin sets it via a dedicated endpoint when a resident physically leaves the
complex. The column is `NULL` for active residents and is never set by the resident
themselves.

### Lawful basis

Retention after departure is justified under **GDPR Art. 6(1)(f) — Legitimate
Interests**:

- Outstanding financial disputes (unpaid charges, damage deposits).
- Operational continuity (handover notes, historical maintenance context).
- The board assessed this interest against resident rights and concluded 1 year is
  proportionate; no longer retention is permitted under this basis.

### Purge sweep

`PurgeExpiredContacts` (new use case, Slice 2) bulk-deletes rows where:

```sql
DepartedAt IS NOT NULL AND DepartedAt < DATEADD(year, -1, GETUTCDATE())
```

The sweep is triggered by a board admin endpoint (not a background service) to keep
infrastructure simple and the trigger human-auditable.

## Consequences

- **Schema migration required:** `ALTER TABLE dbo.HouseholdContacts ADD DepartedAt datetimeoffset NULL;`
- **`SqlDirectoryStore.ReadRow` must be updated** — it uses ordinal-position access;
  `DepartedAt` must be appended at the end of the `SELECT` list to avoid shifting
  existing ordinals.
- **`MarkDeparted` use case required** — board-only, sets `DepartedAt = GETUTCDATE()`.
- **`PurgeExpiredContacts` use case required** — board-only, bulk DELETE.
- **`HouseholdContact` domain record gains `DepartedAt: DateTimeOffset?`.**
- Art. 17 on-demand erasure (PR #11) is unaffected — it hard-deletes immediately
  regardless of `DepartedAt`.
- Residents who exercised Art. 17 erasure before departure have no row to purge;
  the sweep is idempotent.
