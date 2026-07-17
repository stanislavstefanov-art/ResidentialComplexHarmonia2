# Harmonia API Containerisation — Design Spec

**Slice:** 1 of 4 (Azure deployment preparation)
**Date:** 2026-07-17
**Branch:** feat/azure-cicd

---

## Goal

Make `Harmonia.Api` deployable to Azure Container Apps by adding a production Dockerfile,
a `/healthz` liveness probe, and CORS middleware that accepts configurable origins.
No IaC, no CI/CD YAML, and no frontend changes are in scope for this slice.

---

## 1. Dockerfile

**Location:** `/Dockerfile` (repo root — build context must include all three source projects).

**Pattern:** Multi-stage build.

- **Stage 1 (`sdk:8.0`)** — restores NuGet packages and publishes a Release build to `/app/publish`.
- **Stage 2 (`aspnet:8.0`)** — copies the publish output and sets the entrypoint.

**Base image choice:** `mcr.microsoft.com/dotnet/aspnet:8.0` (Debian). Alpine is excluded because
`Microsoft.Data.SqlClient` has native dependencies that require glibc.

**Port:** 8080. `ASPNETCORE_URLS=http://+:8080` matches Azure Container Apps' default ingress
target port. No HTTPS termination inside the container — Container Apps handles TLS at the
ingress layer.

**Layer caching:** `.csproj` files and `Harmonia.sln` are copied before source so the
`dotnet restore` layer is only invalidated when project files change, not on every source edit.

**No `.dockerignore` changes needed for this slice** — the repo has no large binary artefacts
that would bloat the build context.

---

## 2. `/healthz` liveness endpoint

**Route:** `GET /healthz` → `200 OK` (no body required by Container Apps).

**Implementation:** A single `app.MapGet` call in `Program.cs` returning `Results.Ok()`.

**No database ping.** `Program.cs` already throws `InvalidOperationException` at startup if any
of the six connection strings is missing, so a pod that reaches the running state has already
validated its configuration. Adding a DB round-trip to every liveness probe would create
unnecessary load and latency without improving observability.

**Placement:** Added after all `builder.Services.*` registrations and before the first
`app.MapGet` route, alongside the `app.UseCors()` call.

---

## 3. CORS middleware

**Config key:** `Cors:AllowedOrigins` — a string array in `appsettings.json`, defaulting to
an empty array so no origins are allowed unless explicitly configured.

**Development defaults:** `appsettings.Development.json` sets
`["http://localhost:4200", "http://localhost:3000"]` so the Angular and React apps work locally
without any extra setup.

**Production/staging origins:** Not hardcoded. The Azure SWA URLs will be known only after
Slice 3 provisions the infrastructure. They are injected as environment variables
(`Cors__AllowedOrigins__0`, `Cors__AllowedOrigins__1`) into the Container App, sourced from
Key Vault, and will be set as part of the Slice 3/4 work.

**Policy:** `WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()`. No credentials
(`AllowCredentials`) needed — the UIs use bearer tokens in headers, not cookies.

**Middleware order:** `app.UseCors()` is called immediately after `app.UseAuthentication()` /
`app.UseAuthorization()` and before the first `app.MapGet` call, matching ASP.NET Core's
required middleware pipeline order.

---

## 4. Files changed

| File | Change |
|---|---|
| `/Dockerfile` | New — multi-stage build |
| `src/Harmonia.Api/Program.cs` | Add CORS services + middleware + `/healthz` route |
| `src/Harmonia.Api/appsettings.json` | Add `"Cors": { "AllowedOrigins": [] }` |
| `src/Harmonia.Api/appsettings.Development.json` | Add `"Cors": { "AllowedOrigins": ["http://localhost:4200", "http://localhost:3000"] }` |

---

## 5. Out of scope

- IaC (Bicep) — Slice 3
- GitHub Actions CD workflow — Slice 4
- Frontend API URL substitution — Slice 2
- `staticwebapp.config.json` — Slice 2
- Azure SQL schema migration — Slice 4
- HTTPS inside the container
- Docker Compose for local multi-service dev
