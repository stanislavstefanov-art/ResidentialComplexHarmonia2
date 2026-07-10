# ADR-0002 — Reservation store (the concrete atomic-capable engine)

**Status:** Accepted (2026-07-10) — closes the *build / local-verification* scope of
**G-INFRA-1/2** (#6, the concrete store choice) for `reserve-bbq-slot`. **Builds on the
already-confirmed Option A** (GATE-ARCH-1 / #3, `paused-approved` 2026-07-10) — this ADR does
**not** re-decide the concurrency mechanism, it only picks the concrete store that enforces it.
Production provisioning (a hosted instance, region grant, budget, release) stays gated
(#5, #6-prod, #7).
**Deciders:** Product owner (as board proxy) + architecture owner.
**Relates to:** ADR-0001 (identity trust root — supplies `householdRef`); GATE-ARCH-1 /
run-local `400-architecture.md` ADR-001 (Option A, already confirmed); `500-implementation.md`
(LA-500-4, finding F1); `900-security-review.md` (R4 — `householdRef` out of logs).

## Context

The mechanism is already settled: **GATE-ARCH-1 is closed** — Option A, a store-level atomic
conditional claim ("set holder iff currently unheld"), where the datastore decides the race and
the app never read-then-writes on the claim path. What that gate did **not** decide is *which
concrete store* enforces it.

That gap is load-bearing. Finding **F1 (High)**: correctness depends entirely on the store
genuinely providing an atomic conditional write — a store without it silently degrades to
best-effort. With no concrete store chosen, Pipeline 2's decisive concurrency proof (**T13/T14**
— two simultaneous claims → one winner) has nothing real to run against. This decision changes
what the code must do (the store adapter + schema), so per build-guide §4.2 it is recorded here
as an ADR that rides into the Pipeline-2 review bundle, not merely as a status flip.

## Decision

1. **Adopt the already-confirmed Option A** (GATE-ARCH-1). This ADR does not re-open the
   mechanism; it selects the engine.

2. **Slot identity & uniqueness.** A reservation is keyed by **`(day, slotKey)`** with a
   **UNIQUE constraint**. A claim is an atomic conditional insert that commits **iff no holder
   exists**; the winner is decided by that write alone.

3. **Concrete store — SQL Server.** Any store qualifies **iff it provides a real atomic
   conditional write** (F1 is a *disqualifying* criterion). The choice is **SQL Server**, for the
   free-long-term + local-parity reasons a near-zero-budget residents' association needs:
   - **Hosted/prod:** Azure SQL Database, **free-forever serverless** tier, **EU region** (R3).
   - **Local/dev + CI:** SQL Server 2022 in a **Podman** container locally, and a SQL Server 2022
     **service container** in CI — the **same engine as prod**, so the concurrency guarantee is
     proven where it actually ships.
   - **The atomic claim:** a **UNIQUE index on `(day, slotKey)`**; the claim is a plain `INSERT`,
     and the unique index rejects the concurrent loser with `SqlException` **2601/2627**, which
     the store adapter maps to `AlreadyHeldByOther`. The engine decides the race — the app never
     read-then-writes. *(SQL Server's form of the atomic conditional write — NOT
     `INSERT … ON CONFLICT`, which is Postgres/SQLite syntax.)*
   - **The invariant is binding; the engine is swappable** only for another store with an equally
     real atomic conditional write.

   **Engine-parity rule (F1 / the Harmonia lesson):** the integration + concurrency tests
   (**T11–T18, esp. T13/T14**) MUST run against **real SQL Server** (Podman locally / the CI
   service container), never a different or in-memory engine — a substitute would false-pass the
   atomicity. CI must **fail loudly** if the real store is unreachable, not skip. Pure-logic tests
   (T1–T10) use fakes and need no DB.

4. **Store contract (`claimSlot`) returns the four-way discriminated result** (LA-500-4):
   `Claimed` · `AlreadyHeldByMe` · `AlreadyHeldByOther` · `Unavailable`. The refusal-path read
   (me vs other) is off the winner-decision path and cannot create a double-booking.

5. **Holder value & personal data.** The holder stored on a slot is the **`householdRef` from
   ADR-0001** (derived server-side from the verified session, never the body). It is EU personal
   data: keep it **out of logs and errors** (R4). Retention/classification remains **DPO-gated
   (#4)** — not decided here.

## Consequences

- **Unblocks Pipeline 2's load-bearing build:** T13/T14 can run against real SQL Server.
- **F1 is resolved by construction** (real unique index) **and proven** by T13/T14 on the real
  engine — QA must not let that test pass on a substitute.
- **Schema shape follows:** a `Reservations` table with a UNIQUE `(Day, SlotKey)`, `HouseholdRef`,
  `ClaimedAt`. Exact grid granularity depends on **G1** (slot duration/count/window) — fix G1
  before the unique-key format is final.
- **Belongs in the Pipeline-2 enriched bundle** (with `200-spec.md`, `900-security-review.md`,
  ADR-0001) so code-review verifies the atomic-claim invariant and the no-read-then-write rule.

## Still open — NOT closed by this ADR

- **#4 GATE-DATA-1** — `householdRef` retention/classification/EU use limits (DPO).
- **#5 GATE-BUDGET-1** — any spend above free tier (board).
- **#6 (production)** — provisioning the Azure SQL instance + region grant (Ops).
- **#7 GATE-REL-1** — production rollout & SLO.
- **G1 (#8)** — the concrete slot grid (needed to finalise the `(Day, SlotKey)` granularity).
- **G2 (#9)** — cancellation/release.