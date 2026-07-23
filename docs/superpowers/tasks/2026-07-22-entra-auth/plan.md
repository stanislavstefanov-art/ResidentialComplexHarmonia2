# Entra External ID Auth — Slice 1: Infra + API Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the production API so it runs `EntraSession` (JWT validation) instead of `DevSession` (hardcoded stub), enforce authentication on all endpoints by default, and store the 5 AzureAdB2C config values in Key Vault ready for the real Entra tenant.

**Architecture:** The root cause is `ASPNETCORE_ENVIRONMENT: 'Development'` hardcoded in `api.bicep:83` — this forces the `IsDevelopment()` branch in `Program.cs` which registers `DevSession` and skips JWT middleware entirely. Fixing that environment value + adding a fallback auth policy + wiring 5 KV secrets gives the API everything it needs to validate Entra JWTs the moment the Entra tenant exists.

**Tech Stack:** .NET 8 Minimal API, `Microsoft.Identity.Web` (JWT Bearer), xUnit + `Microsoft.AspNetCore.Mvc.Testing`, Bicep (Azure Container Apps / Key Vault), PowerShell 7 deploy script.

---

## Branch

All tasks run on `feat/entra-auth`. If that branch does not yet exist:
```powershell
git checkout -b feat/entra-auth
```

---

## File Map

| File | Change type |
|------|-------------|
| `tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj` | Add `Microsoft.AspNetCore.Mvc.Testing` package reference |
| `src/Harmonia.Api/Program.cs` | Add `public partial class Program {}` + fallback policy + `.AllowAnonymous()` on `/healthz` + remove 4 redundant `.RequireAuthorization()` calls |
| `tests/Harmonia.UnitTests/Api/AuthorizationPolicyTests.cs` | **Create** — `WebApplicationFactory`-based test for fallback policy |
| `infra/modules/keyvault.bicep` | Add 5 `@secure()` params + 5 KV secret resources |
| `infra/modules/api.bicep` | Fix `ASPNETCORE_ENVIRONMENT` value + add 5 KV secret refs + 5 env vars |
| `infra/main.bicep` | Add 5 `@secure()` params + pass to `keyvault` module |
| `deploy.ps1` | Add Entra input block in Phase 1; pass 5 values to Bicep in Phase 2 |

---

## Task 1 — Authorization policy (TDD)

**Files:**
- Modify: `tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj`
- Modify: `src/Harmonia.Api/Program.cs`
- Create: `tests/Harmonia.UnitTests/Api/AuthorizationPolicyTests.cs`

**Test-first: yes** — unauthenticated `GET /directory` must return 401 after fallback policy is wired; `GET /healthz` must return 200 via `.AllowAnonymous()`.

---

- [ ] **Step 1: Add `Microsoft.AspNetCore.Mvc.Testing` to the unit test project**

Open `tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj` and add one line to the existing `<ItemGroup>` that contains the other `<PackageReference>` entries:

```xml
<PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="8.0.0" />
```

The full `<ItemGroup>` block becomes:

```xml
<ItemGroup>
  <PackageReference Include="coverlet.collector" Version="6.0.4" />
  <PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="8.0.0" />
  <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.14.1" />
  <PackageReference Include="xunit" Version="2.9.3" />
  <PackageReference Include="xunit.runner.visualstudio" Version="3.1.4" />
</ItemGroup>
```

---

- [ ] **Step 2: Expose `Program` to the test assembly**

`WebApplicationFactory<Program>` needs to reference the `Program` type from another assembly. .NET 8 top-level statements generate an internal `Program` class; adding a `public partial class Program {}` at the bottom of `Program.cs` makes it accessible.

Append this line to the very end of `src/Harmonia.Api/Program.cs` (after `app.Run();`):

```csharp
app.Run();

// Required so WebApplicationFactory<Program> in test projects can reference this type.
public partial class Program { }
```

---

- [ ] **Step 3: Write the failing test**

Create `tests/Harmonia.UnitTests/Api/AuthorizationPolicyTests.cs`:

```csharp
using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

namespace Harmonia.UnitTests.Api;

public class AuthorizationPolicyTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public AuthorizationPolicyTests(WebApplicationFactory<Program> factory)
    {
        _client = factory
            .WithWebHostBuilder(b =>
            {
                b.UseEnvironment("Production");
                b.ConfigureAppConfiguration((_, cfg) =>
                    cfg.AddInMemoryCollection(new Dictionary<string, string?>
                    {
                        // Required by Program.cs startup guards (any non-empty value is accepted).
                        ["ConnectionStrings:Default"]       = "Server=fake;",
                        ["Vapid:Subject"]                   = "mailto:test@harmonia.example",
                        ["Vapid:PublicKey"]                 = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                        ["Vapid:PrivateKey"]                = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                        ["Acs:ConnectionString"]            = "fake-acs-connection-string",
                        ["Acs:SenderAddress"]               = "noreply@harmonia.example",
                        // AzureAdB2C — needed by AddMicrosoftIdentityWebApi; no network
                        // call is made until a Bearer token actually arrives, so fake
                        // values are safe for unauthenticated-request tests.
                        ["AzureAdB2C:Instance"]             = "https://fake.b2clogin.com/",
                        ["AzureAdB2C:ClientId"]             = "00000000-0000-0000-0000-000000000000",
                        ["AzureAdB2C:Domain"]               = "fake.onmicrosoft.com",
                        ["AzureAdB2C:SignUpSignInPolicyId"] = "B2C_1_SignUpSignIn",
                        ["AzureAdB2C:TenantId"]             = "00000000-0000-0000-0000-000000000001",
                    }));
                b.ConfigureTestServices(services =>
                {
                    // BbqReminderService would attempt a DB connection on startup;
                    // remove hosted services so the test host stays isolated.
                    services.RemoveAll<IHostedService>();
                });
            })
            .CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
    }

    [Fact]
    public async Task Unauthenticated_GET_directory_returns_401()
    {
        var response = await _client.GetAsync("/directory");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Unauthenticated_GET_healthz_returns_200()
    {
        var response = await _client.GetAsync("/healthz");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
```

---

- [ ] **Step 4: Run the tests and confirm RED**

```powershell
dotnet test tests/Harmonia.UnitTests --filter "FullyQualifiedName~AuthorizationPolicyTests" --no-build 2>&1 | Select-String -Pattern "Failed|Passed|Error|FAILED|PASSED"
```

> If the build fails because `Microsoft.AspNetCore.Mvc.Testing` is not yet restored, run `dotnet restore` first.

Expected: `Unauthenticated_GET_directory_returns_401` **FAILS** (the endpoint currently returns 200 or 500, not 401 — no fallback policy is set). `Unauthenticated_GET_healthz_returns_200` may pass (200 today) because there is no auth enforcement.

---

- [ ] **Step 5: Implement the fallback policy in Program.cs**

Three changes to `src/Harmonia.Api/Program.cs`:

**Change A** — Add the missing `using` at the top (after the existing `using` block):

```csharp
using Microsoft.AspNetCore.Authorization;
```

**Change B** — Replace the bare `AddAuthorization()` call on line 95 (inside the `else` branch) with the fallback-policy version:

Before:
```csharp
    builder.Services.AddAuthorization();
```

After:
```csharp
    builder.Services.AddAuthorization(options =>
        options.FallbackPolicy = new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .Build());
```

**Change C** — Add `.AllowAnonymous()` to the `/healthz` endpoint (line 285):

Before:
```csharp
app.MapGet("/healthz", () => Results.Ok());
```

After:
```csharp
app.MapGet("/healthz", () => Results.Ok()).AllowAnonymous();
```

**Change D** — Remove the 4 now-redundant `.RequireAuthorization()` calls from the DELETE directory endpoints. The fallback policy already requires authentication on every endpoint; these guards are duplicate noise.

Before (lines 257-283):
```csharp
app.MapDelete(
    "/directory/contact",
    (EraseMyContact uc, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.EraseMyContactEndpoint(
            uc, loggers.CreateLogger("Directory"), ct))
   .RequireAuthorization();

app.MapDelete(
    "/directory/{householdRef}/contact",
    (EraseContact uc, string householdRef, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.EraseContactEndpoint(
            uc, householdRef, loggers.CreateLogger("Directory"), ct))
   .RequireAuthorization();

app.MapDelete(
    "/directory/{householdRef}/departed",
    (MarkDeparted uc, string householdRef, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.MarkDepartedEndpoint(
            uc, householdRef, loggers.CreateLogger("Directory"), ct))
   .RequireAuthorization();

app.MapDelete(
    "/directory/purge-expired",
    (PurgeExpiredContacts uc, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.PurgeExpiredContactsEndpoint(
            uc, loggers.CreateLogger("Directory"), ct))
   .RequireAuthorization();
```

After (remove the `.RequireAuthorization()` chained call from each):
```csharp
app.MapDelete(
    "/directory/contact",
    (EraseMyContact uc, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.EraseMyContactEndpoint(
            uc, loggers.CreateLogger("Directory"), ct));

app.MapDelete(
    "/directory/{householdRef}/contact",
    (EraseContact uc, string householdRef, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.EraseContactEndpoint(
            uc, householdRef, loggers.CreateLogger("Directory"), ct));

app.MapDelete(
    "/directory/{householdRef}/departed",
    (MarkDeparted uc, string householdRef, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.MarkDepartedEndpoint(
            uc, householdRef, loggers.CreateLogger("Directory"), ct));

app.MapDelete(
    "/directory/purge-expired",
    (PurgeExpiredContacts uc, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.PurgeExpiredContactsEndpoint(
            uc, loggers.CreateLogger("Directory"), ct));
```

---

- [ ] **Step 6: Run the tests and confirm GREEN**

```powershell
dotnet test tests/Harmonia.UnitTests --filter "FullyQualifiedName~AuthorizationPolicyTests"
```

Expected output: `2 passed, 0 failed`.

---

- [ ] **Step 7: Run the full unit test suite (no regressions)**

```powershell
dotnet test tests/Harmonia.UnitTests
```

Expected: all existing tests pass. The `EntraSessionTests` class is unaffected (it does not use `WebApplicationFactory`). The existing endpoint tests (e.g. `DirectoryEndpointsTests`) call endpoint static methods directly and are also unaffected.

---

- [ ] **Step 8: Commit**

```powershell
git add tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj
git add tests/Harmonia.UnitTests/Api/AuthorizationPolicyTests.cs
git add src/Harmonia.Api/Program.cs
git commit -m "feat(auth): add fallback RequireAuthenticatedUser policy; AllowAnonymous on /healthz"
```

---

## Task 2 — Add 5 Entra secrets to `keyvault.bicep`

**Files:**
- Modify: `infra/modules/keyvault.bicep`

**Test-first: no** — Bicep is validated by ARM schema check and `az bicep build`, not by unit tests.

---

- [ ] **Step 1: Add 5 `@secure()` params to `infra/modules/keyvault.bicep`**

After the existing `vapidPrivateKey` param (line 14), append:

```bicep
@secure()
param entraInstance string
@secure()
param entraClientId string
@secure()
param entraDomain string
@secure()
param entraSignUpSignInPolicyId string
@secure()
param entraTenantId string
```

---

- [ ] **Step 2: Add 5 KV secret resources to `infra/modules/keyvault.bicep`**

After the existing `vapidPrivateKeySecret` resource (after line 68, before the `output` block), append:

```bicep
resource entraInstanceSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AzureAdB2C--Instance'
  properties: { value: entraInstance }
}

resource entraClientIdSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AzureAdB2C--ClientId'
  properties: { value: entraClientId }
}

resource entraDomainSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AzureAdB2C--Domain'
  properties: { value: entraDomain }
}

resource entraPolicySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AzureAdB2C--SignUpSignInPolicyId'
  properties: { value: entraSignUpSignInPolicyId }
}

resource entraTenantIdSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AzureAdB2C--TenantId'
  properties: { value: entraTenantId }
}
```

---

- [ ] **Step 3: Validate Bicep syntax**

```powershell
az bicep build --file infra/modules/keyvault.bicep
```

Expected: exits with code 0, no errors. A `keyvault.json` file is written to the same directory — this is a build artifact and is already in `.gitignore` (or can be deleted before committing).

---

- [ ] **Step 4: Commit**

```powershell
git add infra/modules/keyvault.bicep
git commit -m "feat(infra): add 5 AzureAdB2C KV secrets to keyvault.bicep"
```

---

## Task 3 — Fix environment + add Entra refs in `api.bicep`

**Files:**
- Modify: `infra/modules/api.bicep`

**Test-first: no** — validated by `az bicep build`.

---

- [ ] **Step 1: Fix `ASPNETCORE_ENVIRONMENT` (line 83)**

In `infra/modules/api.bicep`, change the value from `'Development'` to `'Production'`:

Before:
```bicep
            {
              name: 'ASPNETCORE_ENVIRONMENT'
              value: 'Development'
            }
```

After:
```bicep
            {
              name: 'ASPNETCORE_ENVIRONMENT'
              value: 'Production'
            }
```

---

- [ ] **Step 2: Add 5 Entra entries to `configuration.secrets`**

Inside the `secrets: [...]` array in `configuration` (after the existing `acs-sender` entry and before the closing `]`), append:

```bicep
        {
          name: 'entra-instance'
          keyVaultUrl: '${keyVaultUri}secrets/AzureAdB2C--Instance'
          identity: identityId
        }
        {
          name: 'entra-client-id'
          keyVaultUrl: '${keyVaultUri}secrets/AzureAdB2C--ClientId'
          identity: identityId
        }
        {
          name: 'entra-domain'
          keyVaultUrl: '${keyVaultUri}secrets/AzureAdB2C--Domain'
          identity: identityId
        }
        {
          name: 'entra-policy'
          keyVaultUrl: '${keyVaultUri}secrets/AzureAdB2C--SignUpSignInPolicyId'
          identity: identityId
        }
        {
          name: 'entra-tenant-id'
          keyVaultUrl: '${keyVaultUri}secrets/AzureAdB2C--TenantId'
          identity: identityId
        }
```

---

- [ ] **Step 3: Add 5 Entra env vars to `template.containers[0].env`**

Inside the `env: [...]` array (after the existing `Acs__SenderAddress` entry and before the closing `]`), append:

```bicep
            {
              name: 'AzureAdB2C__Instance'
              secretRef: 'entra-instance'
            }
            {
              name: 'AzureAdB2C__ClientId'
              secretRef: 'entra-client-id'
            }
            {
              name: 'AzureAdB2C__Domain'
              secretRef: 'entra-domain'
            }
            {
              name: 'AzureAdB2C__SignUpSignInPolicyId'
              secretRef: 'entra-policy'
            }
            {
              name: 'AzureAdB2C__TenantId'
              secretRef: 'entra-tenant-id'
            }
```

---

- [ ] **Step 4: Validate Bicep syntax**

```powershell
az bicep build --file infra/modules/api.bicep
```

Expected: exits with code 0.

---

- [ ] **Step 5: Commit**

```powershell
git add infra/modules/api.bicep
git commit -m "feat(infra): set ASPNETCORE_ENVIRONMENT=Production; add 5 AzureAdB2C KV refs to api.bicep"
```

---

## Task 4 — Wire new params through `main.bicep`

**Files:**
- Modify: `infra/main.bicep`

**Test-first: no** — validated by `az bicep build`.

---

- [ ] **Step 1: Add 5 `@secure()` params to `infra/main.bicep`**

After the existing `@secure() param vapidPrivateKey string` (line 12), append:

```bicep
@secure()
param entraInstance string
@secure()
param entraClientId string
@secure()
param entraDomain string
@secure()
param entraSignUpSignInPolicyId string
@secure()
param entraTenantId string
```

---

- [ ] **Step 2: Pass the 5 params to the `keyvault` module call**

In the `module keyvault 'modules/keyvault.bicep'` block (lines 45-58), add the 5 new params after the existing `vapidPrivateKey` line:

Before (params section ends with):
```bicep
    vapidSubject: vapidSubject
    vapidPublicKey: vapidPublicKey
    vapidPrivateKey: vapidPrivateKey
  }
}
```

After:
```bicep
    vapidSubject: vapidSubject
    vapidPublicKey: vapidPublicKey
    vapidPrivateKey: vapidPrivateKey
    entraInstance: entraInstance
    entraClientId: entraClientId
    entraDomain: entraDomain
    entraSignUpSignInPolicyId: entraSignUpSignInPolicyId
    entraTenantId: entraTenantId
  }
}
```

---

- [ ] **Step 3: Validate the full Bicep template**

```powershell
az bicep build --file infra/main.bicep
```

Expected: exits with code 0, validates cross-module references (the new params must resolve to the new keyvault params).

---

- [ ] **Step 4: Commit**

```powershell
git add infra/main.bicep
git commit -m "feat(infra): pass 5 AzureAdB2C params from main.bicep to keyvault module"
```

---

## Task 5 — Collect Entra config in `deploy.ps1`

**Files:**
- Modify: `deploy.ps1`

**Test-first: no** — PowerShell script; validated by manual review and a dry run without `-Force`.

---

- [ ] **Step 1: Add Entra input block to Phase 1**

In `deploy.ps1`, Phase 1 currently collects `$SqlAdminPasswordSecure` and `$VapidSubject` (lines 70-71). Append the 5 Entra prompts immediately after the `$VapidSubject` line and before the `} catch` line:

Before:
```powershell
    $SqlAdminPasswordSecure = Read-Host 'SQL admin password' -AsSecureString
    $VapidSubject           = Read-Host 'VAPID subject (e.g. mailto:ops@harmonia.example)'
} catch {
```

After:
```powershell
    $SqlAdminPasswordSecure  = Read-Host 'SQL admin password' -AsSecureString
    $VapidSubject            = Read-Host 'VAPID subject (e.g. mailto:ops@harmonia.example)'

    Write-Host "`n  Entra External ID config (from Azure Portal app registration):" -ForegroundColor Gray
    $EntraInstance           = Read-Host '  Entra instance URL (e.g. https://<tenant>.b2clogin.com/)'
    $EntraClientId           = Read-Host '  Entra client ID (app registration GUID)'
    $EntraDomain             = Read-Host '  Entra domain (e.g. <tenant>.onmicrosoft.com)'
    $EntraSignUpSignInPolicy = Read-Host '  Sign-up/sign-in policy ID (e.g. B2C_1_SignUpSignIn)'
    $EntraTenantId           = Read-Host '  Entra tenant ID (GUID)'
} catch {
```

---

- [ ] **Step 2: Pass the 5 Entra values to Bicep in Phase 2**

In Phase 2, the `$paramObj.parameters` hashtable (lines 135-141) currently ends with `useBootstrapImage`. Add the 5 Entra entries after `vapidPrivateKey` and before `useBootstrapImage`:

Before:
```powershell
        parameters     = @{
            sqlAdminPassword  = @{ value = $sqlPass }
            vapidSubject      = @{ value = $VapidSubject }
            vapidPublicKey    = @{ value = $vapidPublicKey }
            vapidPrivateKey   = @{ value = $vapidPrivateKey }
            useBootstrapImage = @{ value = $useBootstrapImage }
        }
```

After:
```powershell
        parameters     = @{
            sqlAdminPassword         = @{ value = $sqlPass }
            vapidSubject             = @{ value = $VapidSubject }
            vapidPublicKey           = @{ value = $vapidPublicKey }
            vapidPrivateKey          = @{ value = $vapidPrivateKey }
            entraInstance            = @{ value = $EntraInstance }
            entraClientId            = @{ value = $EntraClientId }
            entraDomain              = @{ value = $EntraDomain }
            entraSignUpSignInPolicyId = @{ value = $EntraSignUpSignInPolicy }
            entraTenantId            = @{ value = $EntraTenantId }
            useBootstrapImage        = @{ value = $useBootstrapImage }
        }
```

---

- [ ] **Step 3: Clear Entra variables after use**

The existing `Remove-Variable` call on line 143 clears `sqlPass` and `vapidPrivateKey`. Extend it to also clear the 5 Entra variables immediately after:

Before:
```powershell
    Remove-Variable sqlPass, vapidPrivateKey -ErrorAction SilentlyContinue
```

After:
```powershell
    Remove-Variable sqlPass, vapidPrivateKey, EntraInstance, EntraClientId, EntraDomain, EntraSignUpSignInPolicy, EntraTenantId -ErrorAction SilentlyContinue
```

---

- [ ] **Step 4: Validate the script parses without errors**

```powershell
$null = [System.Management.Automation.Language.Parser]::ParseFile(
    (Resolve-Path deploy.ps1).Path, [ref]$null, [ref]$null)
Write-Host 'deploy.ps1 parses OK'
```

Expected: `deploy.ps1 parses OK` (no parse errors printed).

---

- [ ] **Step 5: Commit**

```powershell
git add deploy.ps1
git commit -m "feat(deploy): collect 5 AzureAdB2C inputs in Phase 1 and pass to Bicep"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task that implements it |
|-----------------|------------------------|
| Fix `ASPNETCORE_ENVIRONMENT: 'Development'` in `api.bicep` | Task 3, Step 1 |
| Add 5 AzureAdB2C KV secrets to `keyvault.bicep` | Task 2 |
| Add 5 KV secret refs + env vars to `api.bicep` | Task 3, Steps 2-3 |
| Pass 5 params from `main.bicep` to keyvault module | Task 4 |
| Collect 5 Entra values in `deploy.ps1` | Task 5 |
| Fallback `RequireAuthenticatedUser` policy in `Program.cs` | Task 1, Step 5B |
| `.AllowAnonymous()` on `/healthz` | Task 1, Step 5C |
| Remove 4 redundant `.RequireAuthorization()` guards | Task 1, Step 5D |
| New `AuthorizationPolicyTests.cs` test | Task 1, Steps 3-4 |
| No MSAL UI changes (out of scope) | Not included — correct |

**No placeholders or TBDs found.**

**Type consistency:** `WebApplicationFactory<Program>` requires `public partial class Program {}` (Task 1, Step 2). The `Program` type used in `AuthorizationPolicyTests.cs` (Task 1, Step 3) matches what's exposed in Step 2. Bicep param names (`entraInstance`, `entraClientId`, `entraDomain`, `entraSignUpSignInPolicyId`, `entraTenantId`) are consistent across Task 2, Task 3, Task 4, and Task 5.
