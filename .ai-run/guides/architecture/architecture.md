# Architecture

Pragmatic clean architecture proportionate to this application. Do not add layers beyond the three below. — `docs/context/architecture.md:1`

## Layers

Dependencies point **inward only**. Inner layers never reference outer ones.

| Layer | Project | Responsibility | Must NOT contain |
|---|---|---|---|
| Domain | `src/Harmonia.Domain/` | Pure slot-state derivation, claim-outcome mapping, domain types | EF, HTTP, SqlClient, any I/O type |
| Application | `src/Harmonia.Application/` | Use cases (availability read, slot claim); owns the port interfaces | HTTP, SqlClient, framework types |
| Adapters | `src/Harmonia.Api/` | SQL store, Minimal-API endpoints, session adapter, slot grid | Business rules or domain logic |

## Ports

Defined in `src/Harmonia.Application/Ports.cs`; implemented in `src/Harmonia.Api/`.

| Port | Contract | Current adapter |
|---|---|---|
| `IReservationStore` | `GetDayHoldersAsync` + `ClaimSlotAsync` | `SqlReservationStore` — the only place SQL lives |
| `ISession` | `Resolve() → SessionContext?` | `DevSession` (dev-only; gap #1) |
| `ISlotGrid` | `ForDay(DateOnly) → IReadOnlyList<string>` | `ConfigSlotGrid` (config-as-data; gap G1) |

## Core Invariants

| Rule | How enforced | Evidence |
|---|---|---|
| **R1** — store decides the race, no double-booking | Single atomic `INSERT`; `SqlException` 2601/2627 → classify off the winner path; no app-level read-then-write | `src/Harmonia.Api/Adapters/SqlReservationStore.cs`; ADR-0002 |
| **R2** — identity from verified session only | `_session.Resolve()` before any store access; never body/query/header | `src/Harmonia.Application/ReserveSlot.cs`; ADR-0001 |
| **R3** — `householdRef` is PII, never logged | One log line per claim: `Day/SlotKey/Outcome` only | `src/Harmonia.Api/ReservationEndpoints.cs`; `tests/Harmonia.UnitTests/Api/LogExclusionTests.cs` |

## Frontend

The canonical Harmonia frontend is Blazor WASM (separate repository). This repository also hosts
parallel UI prototypes for a framework comparison exercise (ADR-0005).

| Path | Framework | Library | Status |
|---|---|---|---|
| `ui/angular-prototype/` | Angular | PrimeNG or NG-ZORRO | In progress |
| `ui/react-prototype/` | React | MUI or shadcn/ui | Planned |

**Prototype scope:** member directory listing (resident view, opted-out hidden), edit own contact
form, opt-out toggle. Both prototypes call the local Harmonia API — no auth integration.
Evaluation criteria: component library richness, visual quality, developer experience.
Framework selection for a full build is deferred to a future ADR.

## Open Gaps

From `context/cold/gap-log.md` — do not implement behind these without the named owner:

- **Gap #1** — Real IdP adapter behind `ISession`; `DevSession` blocks non-Development startup
- **Gap #2** — `householdRef` retention/classification (DPO sign-off required)
- **Gap G1** — Slot grid is one-slot-per-day config; hourly = config change, not code change
