# MR draft — feat: reserve the shared BBQ zone (reserve-bbq-slot)

> Prepared by Pipeline 2 on 2026-07-11. Not yet posted: the repo has no git remote and
> no `.ai-run/guides/` (knowledge-foundation deferred by owner 2026-07-10), so
> `mr-creator` halted at its guide gate. Post this body verbatim once a remote and
> MR adapter exist. Target: `main`/`master`, squash-merge per
> `docs/context/standards/git-workflow.md`. No ticket tracker is configured (none
> detected in repo); title carries the feature slug instead.

**Title:** `feat: reserve the shared BBQ zone — atomic no-double-booking slice (reserve-bbq-slot)`

---

## Summary

Implements the reserve-bbq-slot vertical slice: a signed-in resident views a day's BBQ
slot availability and claims a free slot, with a store-enforced guarantee that two
households can never hold the same slot. C#/.NET 8 Minimal API, clean-architecture
layering, SQL Server store where the PRIMARY KEY (DayDate, SlotKey) decides every race.

## Provenance (spec → plan → ADR → tests)

| Link | Artefact |
|------|----------|
| Spec | `runs/reserve-bbq-slot/200-spec.md` (AC-1..AC-6, NFR-1..4) |
| Plan | `runs/reserve-bbq-slot/500-implementation.md` (test table T1–T19) |
| ADRs | ADR-0001 (identity trust root, R2) · ADR-0002 (atomic-claim store, R1) |
| Security | `runs/reserve-bbq-slot/900-security-review.md` (SEC-CHK-10/17 enforced in code) |
| Tests | 34 green: 27 unit (fakes, no DB) + 7 integration/concurrency on REAL SQL Server |
| QA gates | `runs/reserve-bbq-slot/qa-report.md` — lint/build/unit/Rel all PASS |
| Review | superpowers code-reviewer, verdict "with fixes"; both Important findings fixed (6b671bf) |

**Invariant chain:** AC-4 → Option A (400) → UC-1 (700) → PK in `db/schema.sql` → T13/T14.

## Changes

- `src/Reserve.Domain` — pure derivations: SlotStateDeriver (T1–T3), OutcomeMapper (T4–T7).
- `src/Reserve.Application` — ISession/IReservationStore/ISlotGrid ports; GetDayAvailability
  + ReserveSlot use cases (residency gate, no read-then-write on the claim path).
- `src/Reserve.Api` — two Minimal-API endpoints (translation only); SqlReservationStore
  (one atomic INSERT, 2601/2627 → classify off the winner path); DevSession (dev-only,
  refuses to boot outside Development); ConfigSlotGrid (grid is data, G1).
- `db/schema.sql` — Reservations table; the PK IS the concurrency mechanism.
- Tests in two tiers; the Rel tier throws without a real SQL Server — no skip path.

## Commits

- `9e6df05` docs: Pipeline 2 context bundle
- `81930de` feat: scaffold + domain/application (T1–T10)
- `9df6703` feat: SQL store, endpoints, composition root (T11–T18, T16)
- `6b671bf` fix: review findings (fail-safe DevSession, full T16)
- `f71f956` docs: architecture.md store wording
- `db5b4dc` test: QA gate report

## Open gaps carried (NOT closed by this MR — context/cold/gap-log.md)

- Real IdP behind `ISession` (gap #1, ADR-0001 #6) — DevSession stands in; app refuses
  to start outside Development.
- `householdRef` retention/classification (gap #2, DPO).
- Slot grid is one-slot-per-day config (gap #3, G1); hourly = config change.
- T19 (phone double-tap UX) is manual — carried as TC-34 in `600-test-plan.md`.

## Checklist

- [x] Self-reviewed + independent code review with enriched bundle
- [x] All tests watched red first (TDD); 34/34 green
- [x] Concurrency proof on real SQL Server (never in-memory, never skipped)
- [x] No secrets committed (conn string via git-ignored local config / env)
- [ ] Manual T19 exploratory check on a phone (owner)
