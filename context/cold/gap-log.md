# Gap log

Things the code/agent cannot infer — decided by a human, not assumed.

- **status: CLOSED** — decided by ADR-0003 (`docs/architecture/decisions/ADR-0003-identity-provider.md`); shipped in code by PR #5 (master `920fa4c`)
  **description:** Concrete IdP = Microsoft Entra External ID. `EntraSession : ISession` reads `extension_role` and `extension_householdRef` from JWT claims; `Microsoft.Identity.Web` validates the token. Dev stubs remain behind `IsDevelopment()` guard. Spec: `docs/superpowers/specs/2026-07-12-entra-session-adapter-design.md`.
  **discovery_event:** ADR-0001 deferred the vendor to the production-provider gate (#6); `ISession`
  is the port it plugs into (`docs/context/architecture.md`).
  **refresh_trigger:** N/A — decided and shipped.

- **status: CLOSED** — closed by ADR-0004 (2026-07-16). Retention = 1 year after DepartedAt. DepartedAt set by board admin on departure. PurgeExpiredContacts sweeps annually.
  **discovery_event:** GATE-DATA-1 (#4) — DPO-owned; closed 2026-07-16.
  **refresh_trigger:** N/A — decided.

- **description:** Admin role not wired to a real IdP — `DevAdminSession` is a dev-only stand-in
  yielding `SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null)` controlled by
  `Session:IsAdmin` in local config. A real admin adapter must close ADR-0001 gate #6 first.
  **discovery_event:** Gap #4 opened when `IsAdmin` flag added to `SessionContext` for maintenance-fee ledger.
  **refresh_trigger:** before any admin action is exposed to real users.

- **description:** Slot grid is one-slot-per-day; hourly slots + range-booking atomicity deferred.
  **discovery_event:** G1 (#8) recorded-open; range-booking is a concurrency-contract decision.
  **refresh_trigger:** when multi-hour booking is scheduled.