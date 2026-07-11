# Architecture

Pragmatic clean architecture — proportionate to a small app. Do NOT add layers beyond these.

## Layers (dependencies point INWARD only)
- **Domain** (pure, no I/O): slot-state derivation, claim-outcome mapping, policies. No EF, no HTTP,
  no Angular types. Unit-tested directly with no DB.
- **Application** (use cases): the availability-read and reserve-claim orchestration. Depends on the
  domain + the ports below; no framework types.
- **Adapters / Infrastructure** (the edges): EF Core store, the Minimal-API endpoints, the Angular
  UI, the session/IdP. These translate to/from the outside world; they hold no business rules.

## Ports (defined by Application, implemented by adapters)
- `IReservationStore` — the atomic claim (`claimSlot`) + reads. The **only** place SQL/EF lives.
- `ISession` — resolves the verified session → `{ isResident, householdRef }` (ADR-0001).

## Rules
- Domain + Application reference **no** EF/HTTP/Angular types.
- The API handler and the store adapter **translate only** — no business logic in either.
- The store adapter's claim path is a single atomic write — **no read-then-write** (R1).
- `householdRef` comes from `ISession`, never from a request body/query/header (R2).

## Don't
- Add repository/service/manager layers "for symmetry." Two ports is enough.
- Leak `DbContext`, `HttpRequest`, or DTOs into the domain.