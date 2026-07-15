# Security

## Identity (R2)

Household identity derives **only** from the verified session. Never read it from the request body, query string, or any header.

| Avoid | Prefer |
|---|---|
| `householdRef` from request body | `ctx = _session.Resolve()` then check `ctx is { IsResident: true }` — `src/Harmonia.Application/ReserveSlot.cs` |
| Proceeding without a valid session | Return `Refused` immediately; no store access, no slot data returned |

Authority: ADR-0001. Port contract: `ISession` in `src/Harmonia.Application/Ports.cs`.

## PII and Logging (R3)

`householdRef` is personal data under EU GDPR. Never log it, never return it to callers other than the holder. The same principle extends to **every personal data field this app stores** — any field added by a future feature (display name, phone, email, notes, …) is subject to the same rules from the moment it is introduced.

| Avoid | Prefer |
|---|---|
| `logger.Log(..., householdRef)` | `logger.LogInformation("Claim {Day}/{SlotKey}: {Outcome}", day, slotKey, outcome)` — `src/Harmonia.Api/ReservationEndpoints.cs` |
| Returning personal data of User A to User B without confirmed lawful basis | Confirm lawful basis (legitimate interest or explicit consent) with the board + DPO before building any endpoint that intentionally shares one user's personal data with another |

Test enforcement: `tests/Harmonia.UnitTests/Api/LogExclusionTests.cs` asserts `householdRef` never appears in any log line across all four `ClaimResult` outcome paths.

### Cross-user personal data sharing — compliance gate

Any feature whose primary purpose is to expose personal data of one resident to another (e.g. a directory, a contacts list, a presence indicator) introduces a **new data processing activity** not covered by R3 as stated above. Before such a feature proceeds to build:

1. Identify the lawful basis under GDPR Art. 6 (legitimate interest or explicit consent).
2. Get written board + DPO confirmation of that basis.
3. Record the decision as an ADR.

**This gate is not autonomous-resolvable.** A stand-in agent must not declare it closed. Surface it to the human operator and stop.

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
| `householdRef` retention/classification (gap #2) | DPO | Production data handling **and** any feature introducing new personal data fields or cross-user data sharing — do not build until DPO sign-off or explicit deferral with named owner and expiry |
| Rate limiting on the claim endpoint | Engineering | Production hardening |
