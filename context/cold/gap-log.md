# Gap log

Things the code/agent cannot infer — decided by a human, not assumed.

- **description:** Concrete identity provider (IdP) behind the `ISession` port not chosen — the build
  fakes `ISession` yielding `{ isResident, householdRef }`. Both the .NET API and the Angular client
  depend on this seam; swapping the fake for the real IdP adapter needs NO domain/application change.
  **discovery_event:** ADR-0001 deferred the vendor to the production-provider gate (#6); `ISession`
  is the port it plugs into (`docs/context/architecture.md`).
  **refresh_trigger:** before onboarding real residents / first prod deploy.

- **description:** `householdRef` retention + data-classification policy undecided.
  **discovery_event:** GATE-DATA-1 (#4) — DPO-owned; not closed.
  **refresh_trigger:** before any real personal data is stored.

- **description:** Admin role not wired to a real IdP — `DevAdminSession` is a dev-only stand-in
  yielding `SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null)` controlled by
  `Session:IsAdmin` in local config. A real admin adapter must close ADR-0001 gate #6 first.
  **discovery_event:** Gap #4 opened when `IsAdmin` flag added to `SessionContext` for maintenance-fee ledger.
  **refresh_trigger:** before any admin action is exposed to real users.

- **description:** Slot grid is one-slot-per-day; hourly slots + range-booking atomicity deferred.
  **discovery_event:** G1 (#8) recorded-open; range-booking is a concurrency-contract decision.
  **refresh_trigger:** when multi-hour booking is scheduled.