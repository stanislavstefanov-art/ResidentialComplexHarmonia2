# Stack

**Language / framework:** C# / .NET 8. HTTP via ASP.NET Core Minimal API (two endpoints).
**Data access:** `Microsoft.Data.SqlClient` (raw ADO.NET — the atomic claim is a single INSERT,
no ORM needed). Money/keys are typed; no dynamic SQL string-building for values (parameters only).
**Store:** SQL Server. Local/dev + CI = SQL Server 2022 in a **Podman** container (same engine as
prod). Prod = Azure SQL Database, free-forever serverless, **EU region**. (ADR-0002.)
**Tests:** xUnit. Pure-logic tests use fakes (no DB). Integration + concurrency tests run against a
**real SQL Server** — never in-memory.
**Identity:** Microsoft Entra External ID (ADR-0003) — social login (Google OAuth 2.0) + local
accounts; invite-only; `householdRef` and role as custom claims (`extension_householdRef`,
`extension_role`); JWT validated by `Microsoft.Identity.Web` in the API; dev stubs
(`DevSession`/`DevAdminSession`) remain behind `IsDevelopment()` guard.

## Build / test / run
dotnet build
dotnet test                       # all tests
dotnet test --filter Category=Rel # integration + concurrency, needs a real SQL Server
dotnet run --project src/<Api>    # local run
Podman SQL Server (local):
podman run -d --name reserve-mssql -e ACCEPT_EULA=Y
  -e MSSQL_SA_PASSWORD=<dev-throwaway> -p 127.0.0.1:1433:1433
  mcr.microsoft.com/mssql/server:2022-latest
(Publish on `127.0.0.1` — Podman-on-Windows otherwise forwards only IPv6 and SqlClient can't connect.)

## The one architectural constraint — R1 (no double-booking)
A reservation is `(Day, SlotKey)` with a **UNIQUE index**. A claim is a plain `INSERT`; the unique
index decides the race. Map the result:
- INSERT commits → `Claimed`
- `SqlException` **2601 / 2627** (unique violation) → then read the existing holder:
  same household → `AlreadyHeldByMe`; different → `AlreadyHeldByOther`
- timeout / connection error → `Unavailable`

**The engine decides the winner. No app-level read-then-write on the claim path** — the post-loss
read only *classifies* an already-lost race. The concurrency test (two simultaneous claims → exactly
one winner) MUST run on a real SQL Server.

## Model-now-for-later
Slot key is `(Day, SlotKey)` even though v1 uses one slot/day (`SlotKey` constant). Going to hourly
slots is a config/data change, not a migration. (G1 — see gap-log.)