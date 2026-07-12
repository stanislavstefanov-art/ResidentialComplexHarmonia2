# Work Item: Wire EntraSession ISession Adapter

**Status**: In Progress
**Slug**: entra-session-adapter
**External Ticket**: none
**External Sync**: pending
**Branch**: TBD
**Run**: 20260712-1434-master

## Goal

Wire a real `ISession` adapter (`EntraSession`) backed by Microsoft Entra External ID (ADR-0003). Replace the dev-stub session resolvers with a JWT-claims-based implementation while keeping `DevSession`/`DevAdminSession` available behind the `IsDevelopment()` guard.

## Acceptance Criteria

- `EntraSession : ISession` reads `HttpContext.User.Claims`: `extension_householdRef` → `HouseholdRef?`, `extension_role` (`admin`|`resident`) → `IsAdmin`/`IsResident`.
- `Microsoft.Identity.Web` JWT validation middleware wired in `Program.cs`.
- `DevSession`/`DevAdminSession` remain, registered only when `IsDevelopment()` is true.
- All existing unit and Rel tests pass without an Entra tenant configured.
- Gap #1 in `context/cold/gap-log.md` confirmed closed (already marked by ADR-0003).

## Linked Artifacts

- `docs/superpowers/runs/20260712-1434-master/requirements.md`

## History

- 2026-07-12T14:34:00Z — work item created from raw_input (entra-session-adapter)
- 2026-07-12T14:34:00Z — requirements.md linked
