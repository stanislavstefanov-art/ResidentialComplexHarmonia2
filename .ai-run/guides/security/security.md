# Security

## Identity (R2)

Household identity derives **only** from the verified session. Never read it from the request body, query string, or any header.

| Avoid | Prefer |
|---|---|
| `householdRef` from request body | `ctx = _session.Resolve()` then check `ctx is { IsResident: true }` — `src/Harmonia.Application/ReserveSlot.cs` |
| Proceeding without a valid session | Return `Refused` immediately; no store access, no slot data returned |

Authority: ADR-0001. Port contract: `ISession` in `src/Harmonia.Application/Ports.cs`.

## PII and Logging (R3)

`householdRef` is personal data under EU GDPR. Never log it, never return it to callers other than the holder.

| Avoid | Prefer |
|---|---|
| `logger.Log(..., householdRef)` | `logger.LogInformation("Claim {Day}/{SlotKey}: {Outcome}", day, slotKey, outcome)` — `src/Harmonia.Api/ReservationEndpoints.cs` |

Test enforcement: `tests/Harmonia.UnitTests/Api/LogExclusionTests.cs` asserts `householdRef` never appears in any log line across all four `ClaimResult` outcome paths.

## Environment Guard

`DevSession` is a dev-only identity stand-in. `Program.cs` throws `InvalidOperationException` at startup outside the `Development` environment. Never run or deploy with `DevSession` against non-dev data or traffic.

Reference: `src/Harmonia.Api/Program.cs`; `context/cold/gap-log.md` gap #1.

## Concurrency Safety (R1)

Double-booking is prevented by the SQL Server PRIMARY KEY on `(DayDate, SlotKey)`, not by application-layer locking. Any read-then-write pattern on the claim path is a security and correctness violation.

Reference: `db/schema.sql`; `src/Harmonia.Api/Adapters/SqlReservationStore.cs`; ADR-0002; `tests/Harmonia.IntegrationTests/SqlReservationStoreTests.cs` (T13 concurrency proof).

## Open Security Gaps

From `runs/reserve-bbq-slot/900-security-review.md` and `context/cold/gap-log.md`:

| Gap | Owner | Blocks |
|---|---|---|
| Real IdP behind `ISession` (gap #1) | Architecture / IdP team | Any non-Development deployment |
| `householdRef` retention/classification (gap #2) | DPO | Production data handling |
| Rate limiting on the claim endpoint | Engineering | Production hardening |
