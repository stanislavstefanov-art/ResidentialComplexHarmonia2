# Technical Research

**Task**: cicd github-actions azure deployment
**Generated**: 2026-07-17T00:00:00Z
**Research path**: filesystem

---

## 1. Original Context

Add GitHub Actions CI/CD pipeline deploying Harmonia to Azure: API (ASP.NET Core .NET 8 minimal-API) to Azure Container Apps, Angular UI and React UI to Azure Static Web Apps, SQL Server to Azure SQL. Two environments: staging and production. Secrets via Azure Key Vault. Azure subscription ID: 592c2975-9876-4ef5-a889-50b18b6f7137, tenant ID: 53501373-9ca8-4dd7-a300-6985e54ffbe6.

---

## 2. Codebase Findings

### Existing Implementations

- `C:\Users\Stanislav_Stefanov\WorkingArea\ResidentialComplexHarmonia2\.github\workflows\ci.yml` — existing CI workflow; builds and tests the .NET solution on push/PR to `master` using Ubuntu with a SQL Server 2022 service container; runs unit tests, then integration tests filtered by `Category=Rel` with `HARMONIA_SQL_CONNSTR` env var. **No CD (deploy) steps exist.** No workflow files for staging or production deployment exist.
- `C:\Users\Stanislav_Stefanov\WorkingArea\ResidentialComplexHarmonia2\Harmonia.sln` — solution root with three source projects: `Harmonia.Domain`, `Harmonia.Application`, `Harmonia.Api`; and two test projects: `Harmonia.UnitTests`, `Harmonia.IntegrationTests`.
- `C:\Users\Stanislav_Stefanov\WorkingArea\ResidentialComplexHarmonia2\src\Harmonia.Api\` — ASP.NET Core .NET 8 Minimal API. No Dockerfile exists anywhere in the repo root or `src/`. A Dockerfile must be authored for Container Apps deployment.
- `C:\Users\Stanislav_Stefanov\WorkingArea\ResidentialComplexHarmonia2\src\Harmonia.Api\Program.cs` — all six connection strings are loaded at startup and throw `InvalidOperationException` if any is missing. Config keys: `ConnectionStrings:Reservations`, `ConnectionStrings:MaintenanceFees`, `ConnectionStrings:Expenses`, `ConnectionStrings:Payments`, `ConnectionStrings:Notifications`, `ConnectionStrings:Directory`. Environment variable form: `ConnectionStrings__Reservations` (double-underscore separator). Also requires: `Vapid:Subject`, `Vapid:PublicKey`, `Vapid:PrivateKey`, `Acs:ConnectionString`, `Acs:SenderAddress`, and `AzureAdB2C:*` (tenant, clientId, policy) in non-Development environments.
- `C:\Users\Stanislav_Stefanov\WorkingArea\ResidentialComplexHarmonia2\src\Harmonia.Api\appsettings.json` — all secrets are empty strings; confirms no defaults are baked in. `appsettings.Development.local.json` is git-ignored per `.gitignore`.
- `C:\Users\Stanislav_Stefanov\WorkingArea\ResidentialComplexHarmonia2\src\Harmonia.Api\Harmonia.Api.csproj` — NuGet packages: `Azure.Communication.Email 1.*`, `Microsoft.Data.SqlClient 5.2.2`, `Microsoft.Identity.Web 3.*`, `WebPush 1.*`.
- `C:\Users\Stanislav_Stefanov\WorkingArea\ResidentialComplexHarmonia2\db\schema.sql` — **fully idempotent**: all `CREATE TABLE` statements are guarded with `IF OBJECT_ID(...) IS NULL`; the `ALTER TABLE` for `DepartedAt` column is guarded with `IF COL_LENGTH(...) IS NULL`. Safe to run on every deploy. Six tables: `MaintenanceFeeCharges`, `AssociationExpenses`, `Reservations`, `MaintenanceFeePayments`, `PushSubscriptions`, `NotificationHistory`, `HouseholdContacts`.
- `C:\Users\Stanislav_Stefanov\WorkingArea\ResidentialComplexHarmonia2\ui\angular-prototype\` — Angular 21 application. Build command: `ng build` (default configuration is `production`). No `outputPath` is set in `angular.json`, so Angular CLI will default to `dist/angular-prototype/browser/`. No `base-href` is set in `angular.json` build options; must be provided at build time for Static Web Apps deployment (`--base-href /`). No `staticwebapp.config.json` exists.
- `C:\Users\Stanislav_Stefanov\WorkingArea\ResidentialComplexHarmonia2\ui\react-prototype\` — React 19 application using Create React App (`react-scripts 5.0.1`). Build command: `react-scripts build`. Output directory: `build/` (CRA default). No `homepage` key in `package.json`. No `staticwebapp.config.json` exists.
- Both UIs hardcode `http://localhost:5000` as the API base URL in every service/api module. This must be replaced (via environment variable, build-time substitution, or a `staticwebapp.config.json` proxy route) before deployment to Azure Static Web Apps.

### Architecture and Layers Affected

- **CI layer** — existing `.github/workflows/ci.yml` must be extended or a new workflow added for CD.
- **Containerisation layer** — Dockerfile for `Harmonia.Api` does not exist; must be created before Container Apps deployment can occur.
- **Database migration layer** — `db/schema.sql` is idempotent and suitable for a `sqlcmd`-based migration step in the pipeline. No EF Core or Flyway migration tooling is used.
- **Configuration / secrets layer** — six connection strings plus VAPID keys, ACS credentials, and Entra B2C settings must be surfaced in the pipeline. All are currently absent from any committed file.
- **Frontend build layer** — both UIs need environment-aware API URL substitution and `staticwebapp.config.json` for SPA routing and (optionally) API proxying.

### Integration Points

- **Azure SQL Database** — all six connection strings point to it. The pipeline must create the database (or assume it exists) and run `db/schema.sql` via `sqlcmd` or Azure CLI.
- **Microsoft Entra External ID (Azure AD B2C)** — ADR-0003: `AzureAdB2C:*` config section drives JWT validation in non-Development environments. The tenant and clientId must be stored in Key Vault and injected as environment variables into the Container App.
- **Azure Communication Services (ACS)** — `Acs:ConnectionString` and `Acs:SenderAddress` required at startup.
- **VAPID push** — `Vapid:Subject`, `Vapid:PublicKey`, `Vapid:PrivateKey` required at startup.
- **Azure Container Apps** — target for `Harmonia.Api`. Requires container registry (ACR recommended), managed identity for Key Vault access, and CORS policy for Static Web Apps origins.
- **Azure Static Web Apps** — targets for Angular and React UIs. Each gets its own SWA resource; both need a deployment token stored as a GitHub Actions secret. SWA does not natively proxy to a separate API unless `staticwebapp.config.json` routes are configured.
- **Azure Key Vault** — all secrets must be stored here; Container Apps can reference Key Vault secrets via managed identity; SWA does not read Key Vault directly (frontend has no secrets).

### Patterns and Conventions

- The existing `ci.yml` uses `actions/checkout@v4`, `actions/setup-dotnet@v4`, raw `dotnet` CLI commands, and a SQL Server service container with a `--health-cmd` option.
- Connection strings in .NET use the double-underscore environment variable format (`ConnectionStrings__Reservations`).
- The `.gitignore` excludes `appsettings.*.local.json` — the pattern for local secret injection.
- The integration test workflow sets `HARMONIA_SQL_CONNSTR` as the test connection string env var; the production code reads `ConnectionStrings:Reservations` (separate key).
- Git workflow (`docs/context/standards/git-workflow.md`): branch names `feat/<slug>`, squash-merge into `master`, CI must be green before merge. CD pipeline should gate staging on CI green and production on staging success plus manual approval.

---

## 3. Documentation Findings

### Guides and Architecture Docs

- `docs/context/stack.md` — confirms .NET 8 Minimal API, SQL Server 2022 (local/CI) / Azure SQL (prod), EU region constraint, xUnit tests, Podman for local SQL.
- `docs/context/standards/git-workflow.md` — branch naming, commit format, squash-merge, CI gate required.
- `docs/architecture/decisions/ADR-0003-identity-provider.md` — Microsoft Entra External ID; `AzureAdB2C` config section; `Microsoft.Identity.Web`; Entra tenant setup is currently a manual Azure Portal step (not IaC).
- `docs/architecture/decisions/ADR-0005-frontend-prototype-strategy.md` — Angular and React are **prototype** apps for framework comparison, not production-grade; no auth integration, no error boundary, no CI pipeline per ADR. This is directly relevant: the ADR explicitly states "neither prototype has a CI pipeline."
- `docs/architecture/decisions/ADR-0002-reservation-store-and-concurrency.md` (not read but referenced in stack.md) — Azure SQL, EU region.
- No `.ai-run/guides/` directory exists in this repository.

### Architectural Decisions

- **ADR-0003**: Entra External ID tenant setup is manual (Azure Portal), not yet in IaC. The pipeline cannot automate Entra tenant creation; it can only inject the already-configured clientId and tenantId via Key Vault secrets.
- **ADR-0005**: The Angular and React apps are explicitly described as prototypes with no intended CI/CD pipeline. Adding CD for them is a scope extension beyond what the ADR anticipated; the evaluation use case (framework comparison) does not require staging/production hosting.
- **stack.md EU region constraint**: Azure resources must be provisioned in an EU region (e.g., `westeurope` or `northeurope`).

### Derived Conventions

- All secrets absent from committed files; injected at runtime via environment variables.
- Docker is not used in CI today; Podman is the local container runtime. The CD pipeline on GitHub Actions (Linux runner) can use Docker without issue.
- No IaC (Bicep/Terraform) exists in the repo; Azure resource provisioning is currently manual.

---

## 4. Testing Landscape

### Existing Coverage

- `tests/Harmonia.UnitTests/` — pure-logic tests with fakes; run without a DB.
- `tests/Harmonia.IntegrationTests/` — real SQL Server tests; filter `Category=Rel`; require `HARMONIA_SQL_CONNSTR` env var.
- Both test projects are already exercised by the existing `ci.yml` workflow.
- No test coverage exists for CI/CD configuration, deployment scripts, or IaC.

### Testing Framework and Patterns

- xUnit; no mock framework visible at the solution level (fakes used instead).
- Integration tests use a `SqlServerFixture` class that applies `db/schema.sql` on each test run (confirmed by schema.sql comment: "Idempotent: SqlServerFixture applies schema.sql on every integration test run").

### Coverage Gaps

- No smoke tests or health-check endpoint (`/health` or `/healthz`) in `Program.cs` — needed to verify Container Apps deployment succeeded. Azure Container Apps requires a health probe path.
- No tests for the CD workflow YAML itself.
- No environment-parity tests (staging vs. production config validation).

---

## 5. Configuration and Environment

### Environment Variables

All required by `Program.cs` in non-Development environments (must be in Key Vault and surfaced to Container App):

| Config key | Env var form | Notes |
|---|---|---|
| `ConnectionStrings:Reservations` | `ConnectionStrings__Reservations` | Azure SQL connection string |
| `ConnectionStrings:MaintenanceFees` | `ConnectionStrings__MaintenanceFees` | Azure SQL connection string |
| `ConnectionStrings:Expenses` | `ConnectionStrings__Expenses` | Azure SQL connection string |
| `ConnectionStrings:Payments` | `ConnectionStrings__Payments` | Azure SQL connection string |
| `ConnectionStrings:Notifications` | `ConnectionStrings__Notifications` | Azure SQL connection string |
| `ConnectionStrings:Directory` | `ConnectionStrings__Directory` | Azure SQL connection string |
| `Vapid:Subject` | `Vapid__Subject` | VAPID push key |
| `Vapid:PublicKey` | `Vapid__PublicKey` | VAPID push key |
| `Vapid:PrivateKey` | `Vapid__PrivateKey` | VAPID push key |
| `Acs:ConnectionString` | `Acs__ConnectionString` | Azure Communication Services |
| `Acs:SenderAddress` | `Acs__SenderAddress` | ACS sender email |
| `AzureAdB2C:Instance` | `AzureAdB2C__Instance` | Entra External ID |
| `AzureAdB2C:Domain` | `AzureAdB2C__Domain` | Entra External ID |
| `AzureAdB2C:TenantId` | `AzureAdB2C__TenantId` | Entra External ID |
| `AzureAdB2C:ClientId` | `AzureAdB2C__ClientId` | Entra External ID |
| `AzureAdB2C:SignUpSignInPolicyId` | `AzureAdB2C__SignUpSignInPolicyId` | Entra External ID |

GitHub Actions secrets required:
- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` — for OIDC federated identity (preferred over client secret)
- `ANGULAR_SWA_DEPLOYMENT_TOKEN`, `REACT_SWA_DEPLOYMENT_TOKEN` — Static Web Apps deployment tokens
- `ACR_LOGIN_SERVER`, `CONTAINER_APP_NAME` (per environment) — Container Apps targets
- `SQL_ADMIN_PASSWORD` — for schema migration step (or use managed identity if Azure SQL supports it)

### Configuration Files

- `src/Harmonia.Api/appsettings.json` — skeleton with empty values; non-Development environments rely on environment variables to override.
- `src/Harmonia.Api/appsettings.Development.json` — only log level override; not relevant to CD.
- `src/Harmonia.Api/Properties/launchSettings.json` — local dev only; not deployed.
- `db/schema.sql` — idempotent DDL; run via `sqlcmd` in pipeline migration step.
- `.github/workflows/ci.yml` — existing CI only; no CD sections.

### Feature Flags and Deployment Concerns

- `ASPNETCORE_ENVIRONMENT` must be set to `Production` (or `Staging`) in Container Apps to activate Entra JWT validation and disable `DevSession`. The existing `IsDevelopment()` guard in `Program.cs` is the critical branch.
- No feature flags exist in the codebase.
- EU region requirement (stack.md, ADR-0002): all Azure resources must be in `westeurope` or `northeurope`.
- Azure subscription ID: `592c2975-9876-4ef5-a889-50b18b6f7137`; tenant ID: `53501373-9ca8-4dd7-a300-6985e54ffbe6`.

---

## 6. Risk Indicators

- **No Dockerfile for Harmonia.Api** — Container Apps deployment requires a container image. A Dockerfile must be authored; it does not exist anywhere in the repo. This is the single largest blocker.
- **Six connection strings, all required at startup** — `Program.cs` throws on missing strings. A single misconfigured Key Vault secret reference will crash the container on startup with no useful Azure health probe response.
- **No `/health` or `/healthz` endpoint** — Azure Container Apps requires a health probe. Without it, the platform cannot confirm a successful deployment and may repeatedly restart the container.
- **API URL hardcoded as `http://localhost:5000` in all Angular and React service files** — every API module in both UIs will need to be updated with environment-aware URL substitution before the UIs can communicate with the deployed API. This affects approximately 9 Angular service files and 9 React api modules.
- **No `staticwebapp.config.json` in either UI** — SPA routing (client-side navigation) will 404 on hard refresh without it. Also needed for any API proxy configuration or authentication routes.
- **ADR-0005 explicitly marks UIs as prototypes with no CI pipeline** — deploying them to production-grade Azure Static Web Apps is a scope decision that supersedes ADR-0005. This should be a recorded human gate.
- **No IaC (Bicep/Terraform)** — Azure resources (Container Apps environment, Container Registry, SQL Database, Key Vault, Static Web Apps) must be manually pre-provisioned or provisioned by a new IaC layer added in this task. The workflow cannot deploy to resources that do not exist.
- **Entra External ID tenant setup is manual (ADR-0003)** — the pipeline cannot create or configure the Entra tenant. `AzureAdB2C:*` values must be populated in Key Vault by a human before the first non-Development deployment will succeed.
- **CORS not configured in `Program.cs`** — when Angular/React SWAs call the Container App API cross-origin, requests will be blocked. CORS middleware must be added to `Program.cs` with the SWA origins explicitly listed.
- **Two environments (staging + production) with shared schema** — `db/schema.sql` is idempotent and safe to run on each deploy, but staging and production should point to separate Azure SQL databases. Connection strings for both must be stored in Key Vault under environment-specific names.
- **`appsettings.Development.local.json` has only two of six connection strings populated** — if this file is used as a reference for Key Vault secret naming, four connection strings (`Expenses`, `Payments`, `Notifications`, `Directory`) might be missed.
- **No container registry (ACR) exists** — must be provisioned before the build-and-push step can run.
- **Angular CLI version mismatch risk** — `package.json` declares `@angular/cli ^21.2.19` and `@angular/core ^21.2.0` but `@angular/animations ^20.1.8` (v20); this peer version mismatch may cause `ng build` to emit warnings or fail in a clean CI environment. Requires verification.
- **React prototype uses CRA (`react-scripts 5.0.1`)** — Create React App is unmaintained as of 2023. `npm install` may emit deprecation warnings; CI on a clean runner should be validated.

---

## 7. Summary for Complexity Assessment

This task touches every architectural layer of the Harmonia repository: a new containerisation layer (Dockerfile for the API), the CI/CD pipeline layer (new or extended GitHub Actions workflow files), the database migration layer (`sqlcmd` execution of `db/schema.sql`), the frontend build layer (both Angular and React UIs), the secrets/configuration layer (Key Vault wiring), and the Azure infrastructure layer (Container Apps, Static Web Apps, ACR, SQL, Key Vault). The estimated file change surface is: 1 new Dockerfile, 1-2 new workflow YAML files (potentially one combined multi-job workflow), updates to ~18 frontend service/api source files (API URL substitution), 2 new `staticwebapp.config.json` files, and likely additions to `Program.cs` (CORS, health endpoint). No IaC exists today, so either manual pre-provisioning or new Bicep/Terraform files are also in scope.

The task introduces significant technical novelty for this codebase. None of the required patterns — container image builds, ACR push, Container Apps deployment via Azure CLI or Bicep, Static Web Apps deployment tokens, Key Vault secret referencing, database migration in CI — exist anywhere in the current `.github/workflows/` directory. The existing `ci.yml` is a minimal build-and-test workflow with no deployment logic. The two UI apps are explicitly described in ADR-0005 as prototypes with "no CI pipeline," so deploying them to Azure Static Web Apps represents a deliberate scope extension that requires a human gate decision. The CORS gap and the hardcoded `localhost:5000` API URLs in all frontend modules are non-trivial source changes required before any functional staging deployment.

Test coverage posture for the CI/CD layer itself is zero — there are no tests for deployment scripts or workflow correctness. The API test suite is well-structured (unit + integration with real SQL) and the CI gate is solid, but the new CD jobs will be untested until exercised against real Azure resources. Key risks that should inflate the complexity score: absence of a Dockerfile (must be authored and validated), absence of a health endpoint (required by Container Apps, must be added to `Program.cs`), six required-at-startup secrets with hard crashes on missing values (zero tolerance for Key Vault misconfiguration), CORS not configured, Entra tenant setup remaining manual, and no IaC for resource provisioning. All of these must be resolved before a staging environment can successfully serve a request.
