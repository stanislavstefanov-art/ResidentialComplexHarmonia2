# Technical Research

**Task**: auth entra msal jwt
**Generated**: 2026-07-22T00:00:00Z
**Research path**: filesystem

---

## 1. Original Context

Implement Entra External ID authentication end-to-end. The IdP decision is already made (ADR-0003): Microsoft Entra External ID with JWT bearer in the API and MSAL.js in the UIs. The API already has EntraSession (src/Harmonia.Api/Identity/EntraSession.cs) and Microsoft.Identity.Web wired in Program.cs — it just needs AzureAdB2C config in Key Vault and the [Authorize] attributes/session guards enforced correctly. Both UIs (Angular PrimeNG and React MUI) need MSAL login/logout UI and Bearer token attached to every fetch/HttpClient call. Infra: add AzureAdB2C Key Vault secrets to deploy.ps1 and Bicep. There is a hard human gate before code can be tested: the Entra External ID tenant must be created manually in Azure Portal with user flows, custom attributes (extension_householdRef, extension_role), and social IdPs registered.

---

## 2. Codebase Findings

### Existing Implementations

**API Identity Adapter (complete, production-ready):**
- `src/Harmonia.Api/Identity/EntraSession.cs` — Reads `extension_role` and `extension_householdRef` from `HttpContext.User.Claims`; returns `SessionContext(IsResident, IsAdmin, HouseholdRef)` or `null` for unauthenticated requests. R2 invariant is fully encoded — HouseholdRef never sourced from request body.
- `src/Harmonia.Api/Adapters/DevSession.cs` — Dev-only stub that yields a fixed resident identity; only instantiated when `IsDevelopment()`.
- `src/Harmonia.Api/Adapters/DevAdminSession.cs` — Dev-only admin stub; throws if instantiated outside Development.
- `src/Harmonia.Application/Session.cs` — `ISession` port interface and `SessionContext` record (IsResident, IsAdmin, HouseholdRef); lives in the Application layer, no HttpContext coupling.

**API Authentication Wiring (complete for non-Development):**
- `src/Harmonia.Api/Program.cs` lines 81–98 — Two-branch conditional: Development uses stubs; non-Development registers `AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAdB2C"))` + `AddAuthorization()` + `AddHttpContextAccessor()` + scoped `EntraSession`.
- `src/Harmonia.Api/Program.cs` lines 128–132 — `app.UseAuthentication()` and `app.UseAuthorization()` placed before all endpoint mappings; guarded by `!IsDevelopment()`.
- `src/Harmonia.Api/Program.cs` line 212 — `email` claim extracted from `httpContext.User?.FindFirst("email")?.Value` — correct R2-compliant pattern already demonstrated.

**Authorization on endpoints (partial):**
- Only 4 of ~27 endpoints carry `.RequireAuthorization()` — all in the GDPR-erase/mark-departed cluster (Program.cs lines 262, 269, 276, 283). The remaining ~23 endpoints enforce session via use-case-layer `session.Resolve()` null-checks that return HTTP 403, not via middleware-level 401. This is intentional by design but leaves a defense gap: without `.RequireAuthorization()`, the middleware does not enforce that a Bearer token is present before the handler runs in production.

**Configuration stub:**
- `src/Harmonia.Api/appsettings.json` lines 9–15 — `AzureAdB2C` section exists with all five required keys (`Instance`, `Domain`, `TenantId`, `ClientId`, `SignUpSignInPolicyId`) set to empty strings. Environment-variable equivalents use `__` separator (e.g. `AzureAdB2C__TenantId`).
- `src/Harmonia.Api/appsettings.Development.json` — Contains only CORS origins; dev identity comes from `Session:IsResident` / `Session:HouseholdRef` config keys.

**Frontend — Angular (PrimeNG, Angular 21.2):**
- `ui/angular-prototype/src/app/app.config.ts` — `provideHttpClient()` is registered with no interceptors. No MSAL module. Zero auth wiring.
- `ui/angular-prototype/src/environments/environment.ts` / `environment.prod.ts` — API base URL only; no Entra/MSAL client configuration.
- 9 Angular services (DirectoryService, ReservationService, PaymentService, ExpenseService, FinancialService, MaintenanceFeeService, NotificationService, PrivacyService, ContactEditService) — all inject `HttpClient` and make bare GET/POST/PUT/DELETE calls with no Authorization header.
- `ui/angular-prototype/src/app/app.routes.ts` — All 10 lazy-loaded routes are open; no route guards.
- `ui/angular-prototype/package.json` — No `@azure/msal-browser`, `@azure/msal-angular`, or any auth library installed.

**Frontend — React (MUI, React 19.2):**
- `ui/react-prototype/src/App.tsx` — Manual `useState<Role>('resident')` toggle; no MsalProvider, no auth context.
- `ui/react-prototype/src/index.tsx` — No MsalProvider wrapping.
- `ui/react-prototype/src/api/config.ts` — Reads `REACT_APP_API_URL` env var; no auth config.
- 9 React API modules (directory.ts, reservations.ts, payments.ts, expenses.ts, financial.ts, maintenanceFees.ts, notifications.ts, privacy.ts, contactEdit.ts) — bare `fetch()` calls, no Authorization header.
- `ui/react-prototype/src/types/index.ts` — `type Role = 'resident' | 'admin'` already defined (line 54); matches Entra `extension_role` claim values.
- `ui/react-prototype/package.json` — No `@azure/msal-browser`, `@azure/msal-react`, or any auth library installed.

**Infrastructure:**
- `infra/modules/keyvault.bicep` — Creates Key Vault secrets for `ConnectionStrings--Default`, `Vapid--*` (3 keys), `Acs--ConnectionString`, `Acs--SenderAddress`. No AzureAdB2C secrets.
- `infra/modules/api.bicep` — Container App env vars inject CORS origins plus secret refs for SQL/Vapid/ACS. `ASPNETCORE_ENVIRONMENT` is hardcoded to `'Development'` (line 83) — this is a blocking bug; production JWT validation requires non-Development mode.
- `infra/main.bicep` + `infra/main.parameters.json` — No AzureAdB2C parameters.
- `deploy.ps1` — Collects SQL password and VAPID subject; generates/retrieves VAPID keys; sets 5 GitHub secrets. No Entra collection step.

### Architecture and Layers Affected

| Layer | Component | State |
|---|---|---|
| Identity Provider | Microsoft Entra External ID tenant | Does not exist yet — hard human gate |
| API — Auth Middleware | `Microsoft.Identity.Web` JwtBearer | Wired in code; needs config values |
| API — Session Adapter | `EntraSession` | Complete |
| API — Endpoint Guards | `.RequireAuthorization()` | Partial (4/27 endpoints) |
| Application — Use Cases | 29 use-case files call `ISession.Resolve()` | Complete; no changes needed |
| UI — Angular Auth Module | MSAL Angular + interceptor | Not started |
| UI — React Auth Module | MSAL React + fetch wrapper | Not started |
| Infra — Key Vault | AzureAdB2C secrets | Not present |
| Infra — Container App | `ASPNETCORE_ENVIRONMENT` + Entra env vars | Blocking bug + missing secrets |
| Infra — deploy.ps1 | Entra secret collection | Not present |

### Integration Points

**Internal:**
- All 29 Application-layer use-case classes inject `ISession` and call `Resolve()` as their first authorization check. No use case reads identity from request body — R2 is structurally enforced at the port boundary.
- `EntraSession` → `IHttpContextAccessor` → `HttpContext.User` (ClaimsPrincipal populated by `Microsoft.Identity.Web` middleware).
- `ISession` port is in `Harmonia.Application`; `EntraSession` adapter is in `Harmonia.Api` — dependency flows inward, as required by the architecture.

**External:**
- Microsoft Entra External ID (OIDC/OAuth 2.0 issuer; validates JWT signatures, manages user flows).
- Google OAuth 2.0, Microsoft Account, Apple (social IdPs registered in Entra — no app code required).
- Azure Key Vault (`residenceharmoniakv`) — all runtime secrets sourced from here; pattern established with `--` separator.
- Azure Container Apps — API is deployed here; env var injection from Key Vault via secretRef.

### Patterns and Conventions

- **Two-branch conditional registration** in `Program.cs`: Development branch uses stubs; non-Development branch wires real adapters. New auth-related services must follow this same gate.
- **Port + Adapter**: `ISession` (Application layer, no I/O) + `EntraSession` / `DevSession` / `DevAdminSession` (API layer adapters). Any new identity-related extension must implement `ISession`, not access `HttpContext` directly.
- **Key Vault secret naming**: `--` separator (e.g. `AzureAdB2C--TenantId`) matching ASP.NET Core's colon-to-double-dash Key Vault convention.
- **Bicep secretRef pattern**: Secrets are declared in `keyvault.bicep`, referenced in `api.bicep` via `secretRef`, and injected as environment variables into the Container App.
- **`REACT_APP_API_URL`** is the established env-var pattern for the React build-time config injection in the CD pipeline (cd.yml line 127).
- **`environment.prod.ts`** is the Angular pattern for build-time config — no runtime injection; build step substitutes the prod environment file.

---

## 3. Documentation Findings

### Guides and Architecture Docs

- `docs/architecture/decisions/ADR-0001-identity-session-trust-root.md` — Establishes R2 (household_ref from session only, never request body/query/header) and R3 (householdRef is PII, never logged). Status: Accepted; closed gate GATE-SEC-1.
- `docs/architecture/decisions/ADR-0003-identity-provider.md` — Closes gap #1: Microsoft Entra External ID selected. Specifies JWT claims (`extension_householdRef`, `extension_role`), invite-only model, MSAL.js + SPA authorization code + PKCE flow, `@azure/msal-browser` for frontend. Status: Accepted 2026-07-12. Explicitly leaves open: Gate #4 (DPO sign-off on householdRef retention), Gate #6 (Entra tenant provisioning), admin authentication in production.
- `docs/architecture/decisions/ADR-0002-reservation-store.md` — Confirms `householdRef` (from session) is the holder value on reservations; atomic conditional write (R1). Not directly changed by this task.
- `docs/context/architecture.md` — Pragmatic clean architecture: three layers (Domain, Application, API/Adapters), two ports (ISession, IReservationStore). Rule: business logic never in API handler or store adapter.
- `docs/context/stack.md` — Identity: Entra External ID + MSAL.js. Build/test commands and the R1 constraint documented here.
- `.ai-run/guides/security/security.md` — R2/R3 enforcement table; rule on cross-user personal data sharing requiring DPO/board approval before proceeding.
- `.ai-run/guides/architecture/architecture.md` — ISession port contract and core invariants table.
- `docs/superpowers/specs/2026-07-12-entra-session-adapter-design.md` — Technical design for the EntraSession adapter; code contract, testing approach. Now implemented.
- `context/cold/gap-log.md` — Gap #1 (concrete IdP) CLOSED. Gap #4 (admin role not wired to real IdP) OPEN. Gap #2 (householdRef retention) CLOSED by ADR-0004.

### Architectural Decisions

1. **ADR-0001 R2**: HouseholdRef derives exclusively from verified session. Consequences for this task: every MSAL token acquisition must return a token that the API middleware validates before `EntraSession.Resolve()` is called. No client-side bypass path is acceptable.
2. **ADR-0003**: Two SPA app registrations needed (Angular + React, each with its own redirect URI). The API has one server-side app registration. Custom attributes (`extension_householdRef`, `extension_role`) must be included in the user flow token claims before any end-to-end test is possible.
3. **ADR-0003** explicitly flags admin authentication as not yet resolved for production: `DevAdminSession` is the current stand-in. This task's scope for admin is limited to wiring the same JWT path; admin user provisioning in the Entra tenant is the Gate #6 item.
4. **ASPNETCORE_ENVIRONMENT hardcoded to 'Development'** in `api.bicep` line 83: this means the deployed Container App currently uses dev stubs (`DevSession`) instead of `EntraSession`. Fixing this to `'Production'` is a prerequisite for any end-to-end JWT validation.

### Derived Conventions

- `.RequireAuthorization()` is preferred over `[Authorize]` attribute because minimal API endpoints are used (no controllers). The 4 existing usages confirm this convention.
- Angular services use constructor injection of `HttpClient` (not `provideHttpClient(withInterceptors([...]))` pattern yet, but `app.config.ts` uses the functional `provideHttpClient()` which supports functional interceptors via `withInterceptors`).
- React API functions are plain async functions in `src/api/`; there is no centralized fetch client/wrapper yet — the Bearer token injection will need a shared utility.

---

## 4. Testing Landscape

### Existing Coverage

**xUnit unit tests (Harmonia.UnitTests):**
- `tests/Harmonia.UnitTests/Api/EntraSessionTests.cs` — 6 tests covering `EntraSession.Resolve()`: null HttpContext, unauthenticated user, resident mapping, admin mapping, empty householdRef, unrecognized roles.
- `tests/Harmonia.UnitTests/Application/AdminSessionContextTests.cs` — 2 tests on `SessionContext` invariants.
- `tests/Harmonia.UnitTests/Application/ResidencyGateTests.cs` — 2 theory cases verifying non-residents are refused and no store is called.
- `tests/Harmonia.UnitTests/Api/ReservationEndpointsTests.cs`, `PaymentEndpointsTests.cs`, `DirectoryEndpointsTests.cs` — Collectively ~20 tests verifying 401/403 responses for insufficient permissions at endpoint level, using `FakeSession`.
- `tests/Harmonia.UnitTests/Api/LogExclusionTests.cs` — Verifies `householdRef` never appears in log output (R3).

**xUnit integration tests (Harmonia.IntegrationTests):**
- `SqlReservationStoreTests`, `SqlDirectoryStoreTests`, `SqlPaymentStoreTests`, `SqlNotificationStoreTests`, `SqlMaintenanceFeeStoreTests`, `SqlExpenseStoreTests`, `SqlListAllChargesTests` — All focus on SQL concurrency and data correctness. No JWT/auth integration tests exist.
- Uses `SqlServerFixture` and real SQL Server via `HARMONIA_SQL_CONNSTR` env var.

**Angular tests (Jasmine/TestBed):**
- `ui/angular-prototype/src/app/reservations/reservations.component.spec.ts`, `financial.component.spec.ts` — Component tests using TestBed, `HttpClientTestingModule`, service mocking. No MSAL or auth mocking.

**React tests (Jest / React Testing Library):**
- `ui/react-prototype/src/App.test.tsx` — Minimal placeholder.
- `ui/react-prototype/src/components/ReservationScreen.test.tsx` and 8 others — Component tests. No MSAL or auth mocking.

### Testing Framework and Patterns

- **.NET**: xUnit 2.9.3; hand-written fakes (`FakeSession`, `FakeMaintenanceFeeStore`, etc.) in `tests/Harmonia.UnitTests/Fakes.cs`; no mocking framework. Test comment on `FakeSession`: "the IdP behind ISession is an open gap (gap-log)" — now closed by ADR-0003.
- **Angular**: Jasmine via Angular TestBed; `provideRouter`, `provideHttpClient`, `HttpClientTestingModule`; service mocking via `useValue` provider.
- **React**: Jest + React Testing Library; `render`, `screen`, no MSW or MSAL mock wrappers.
- **Integration test fixture**: `SqlServerFixture` / `DatabaseCollection` — real SQL Server; CI uses `HARMONIA_SQL_CONNSTR`.

### Coverage Gaps

- **No WebApplicationFactory integration tests**: No test validates that the JWT Bearer middleware correctly rejects requests without a token (401) or with an invalid token before the handler runs. This is the most significant functional gap for this task.
- **No MSAL.js tests**: Angular and React test suites contain zero MSAL mock setup, no HTTP interceptor tests, no token acquisition tests, no logout flow tests, and no route guard tests.
- **No test for `.RequireAuthorization()` enforcement breadth**: No test verifies that all endpoints that should require authentication actually do (only 4 are currently so-decorated; ~23 are not).
- **No admin JWT path test**: `DevAdminSession` is the only admin ISession implementation; no test covers the real Entra admin JWT claim path.

---

## 5. Configuration and Environment

### Environment Variables

| Variable | Set Where | Purpose |
|---|---|---|
| `AzureAdB2C__Instance` | Missing — needs Key Vault + api.bicep | Entra External ID issuer base URL |
| `AzureAdB2C__Domain` | Missing — needs Key Vault + api.bicep | Tenant domain (e.g. `contoso.onmicrosoft.com`) |
| `AzureAdB2C__TenantId` | Missing — needs Key Vault + api.bicep | Azure AD tenant GUID |
| `AzureAdB2C__ClientId` | Missing — needs Key Vault + api.bicep | API app registration client ID |
| `AzureAdB2C__SignUpSignInPolicyId` | Missing — needs Key Vault + api.bicep | B2C user flow name |
| `ASPNETCORE_ENVIRONMENT` | `api.bicep` line 83, hardcoded `'Development'` | Must change to `'Production'` for Entra JWT path |
| `REACT_APP_API_URL` | `cd.yml` line 127 | React build-time API base URL (established pattern) |
| `Session:IsResident` / `Session:HouseholdRef` | Dev config only | Dev stub parameters; not used in non-Development |
| `HARMONIA_SQL_CONNSTR` | CI pipeline | Integration test DB connection; not auth-related |

### Configuration Files

- `src/Harmonia.Api/appsettings.json` — AzureAdB2C section with 5 empty keys. This is the schema definition; values must come from environment variables sourced from Key Vault.
- `src/Harmonia.Api/appsettings.Development.json` — CORS origins for localhost:4200 and localhost:3000 only.
- `ui/angular-prototype/src/environments/environment.ts` + `environment.prod.ts` — API base URL. Must gain MSAL configuration: `clientId`, `authority` (user flow URL), `redirectUri`.
- `ui/react-prototype/src/api/config.ts` — `REACT_APP_API_URL` read at runtime. MSAL config will need a parallel pattern (build-time env vars via `REACT_APP_*`).
- `infra/modules/keyvault.bicep` — Defines 6 existing secrets; needs 5 new `Microsoft.KeyVault/vaults/secrets` resources for AzureAdB2C following the `--` naming convention.
- `infra/modules/api.bicep` — Needs 5 new secretRef entries and corresponding env var mappings. Also needs `ASPNETCORE_ENVIRONMENT` changed from `'Development'` to a parameter or `'Production'`.
- `infra/main.parameters.json` + `infra/main.bicep` — Need AzureAdB2C parameters added (or secrets injected out-of-band via deploy.ps1, matching the VAPID pattern).
- `deploy.ps1` — Needs a new phase to prompt for/retrieve Entra tenant config and store it in Key Vault before Bicep runs.

### Feature Flags and Deployment Concerns

- **`IsDevelopment()` guard** in `Program.cs` is the de-facto feature flag controlling whether real Entra JWT validation runs. Fixing `ASPNETCORE_ENVIRONMENT` in `api.bicep` from `'Development'` to `'Production'` is what activates `EntraSession` in the deployed environment — this is a high-impact one-line infra change.
- **Hard human gate**: The Entra External ID tenant (user flows, custom attributes `extension_householdRef` and `extension_role`, social IdP registrations, app registrations for both API and two SPA clients) must be created manually in Azure Portal. No code can be end-to-end tested until this gate is cleared.
- **CORS**: Development allows `localhost:4200` and `localhost:3000`. Production CORS is driven by Bicep parameter outputs (SWA URLs). MSAL redirect URIs for the two SPA app registrations in Entra must match the deployed SWA hostnames exactly.
- **GitHub Actions secrets**: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` are already set by `deploy.ps1` for CI/CD OIDC federation. Entra B2C tenant/app registration values are separate and must be stored in Key Vault (not GitHub secrets), following the established pattern for SQL/VAPID/ACS.

---

## 6. Risk Indicators

- **`ASPNETCORE_ENVIRONMENT` hardcoded to `'Development'` in `infra/modules/api.bicep` line 83**: The deployed Container App currently runs dev stubs; `EntraSession` never activates in production. This is a silent, blocking misconfiguration. Fixing it switches the live API from unauthenticated dev mode to real JWT enforcement in one infra change.
- **Hard human gate not yet cleared**: Zero end-to-end testing is possible until the Entra External ID tenant, user flows, and custom attributes exist. This gate is explicitly noted in the task context and in ADR-0003.
- **23 of 27 endpoints lack `.RequireAuthorization()`**: They rely on use-case-layer session null checks for 403 responses, not middleware-level 401. In production, this means unauthenticated requests reach handler code before being refused; a middleware gate would reject them earlier. This is a defense-in-depth gap, not a functional hole, but should be addressed for the full auth slice.
- **No MSAL packages installed in either UI**: Both Angular and React frontends have zero authentication wiring. The implementation surface is large: package install, MsalModule/MsalProvider configuration, login/logout UI, HTTP interceptor (Angular) or fetch wrapper (React), route guards, and silent token renewal handling.
- **No WebApplicationFactory integration tests for JWT validation**: The JWT middleware rejection path (401 for missing/invalid Bearer) is untested. Adding these tests requires a test JWT signing key and issuer setup — a non-trivial scaffolding task.
- **No MSAL frontend tests**: Angular Jasmine and React Jest suites have no MSAL mock infrastructure. Frontend auth tests will require `@azure/msal-browser`'s test utilities or a custom wrapper to stub `PublicClientApplication`.
- **Admin authentication gap remains open** (gap-log gap #4): `DevAdminSession` is the only admin identity implementation. Real admin JWT claims require a provisioned admin user in the Entra tenant (also part of the hard human gate). Admin-protected endpoints have no end-to-end path until the gate is cleared.
- **No AzureAdB2C secrets in Key Vault or Bicep**: Five secrets are missing from the established Key Vault pattern; `api.bicep` does not inject them. Until these are added and deployed, the Container App will start with empty `AzureAdB2C` config and fail JWT validation silently (Microsoft.Identity.Web will likely throw at startup or return 401 with no meaningful error).
- **MSAL config values for Angular/React are not yet defined anywhere**: Client IDs, authority URLs, and scopes for the two SPA registrations will need to be decided during tenant setup and then propagated into the Angular environment files and React build-time env vars. No source of truth for these values currently exists in the repo.
- **`codegraph` tool not available**: Research conducted via filesystem fallback only. No codegraph results for any dimension.

---

## 7. Summary for Complexity Assessment

This task is a broad, multi-layer authentication slice touching five distinct areas: API configuration, API endpoint hardening, Angular UI authentication, React UI authentication, and infrastructure secrets/deployment. The API-side adapter (`EntraSession`) and middleware registration are complete and production-quality; the remaining work is wiring the surrounding infrastructure (Key Vault secrets, Container App env vars, ASPNETCORE_ENVIRONMENT fix) and building net-new authentication modules in both UIs. The total file change surface is significant: 5 Bicep/infra files, `deploy.ps1`, 2 Angular environment files plus `app.config.ts` plus a new interceptor and auth service (roughly 4–6 new files), 2 React entry files plus a new MSAL provider/hook/fetch wrapper (roughly 3–5 new files), and `Program.cs` for the endpoint `.RequireAuthorization()` additions. The infra fix (`ASPNETCORE_ENVIRONMENT`) is a single high-impact line.

The task introduces a novel dependency not yet present in either UI: MSAL.js. The Angular MSAL integration requires understanding `@azure/msal-angular`'s functional interceptor pattern and how it fits into Angular 21's `provideHttpClient(withInterceptors([...]))` API. The React integration requires wrapping the root component in `MsalProvider` and replacing or wrapping bare `fetch()` calls across 9 API modules — there is no centralized HTTP client yet, so this involves either introducing one or wrapping each module. Neither UI has test infrastructure for MSAL, so new test patterns will need to be established from scratch.

Test coverage posture is mixed: the .NET unit tier for `EntraSession` and the use-case session gate is solid (6 + ~20 tests), but there are zero integration tests for the JWT middleware path and zero frontend auth tests. The most critical gap for the complexity assessor to weigh is the hard human gate: no code path involving real token exchange can be exercised until the Entra External ID tenant is manually provisioned. This means the implementation phase will need to be structured so that the infra and UI code is written and statically verified first, with end-to-end integration deferred to after the human gate is cleared. The combination of a hard external dependency, two net-new UI authentication modules, an infra blocking bug, and missing test infrastructure places this task at the upper end of medium complexity — or low-end high complexity — for a single slice.
