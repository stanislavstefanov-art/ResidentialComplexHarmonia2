# EntraSession ISession Adapter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire a real `ISession` adapter (`EntraSession`) that reads JWT claims from Microsoft Entra External ID, replacing the boot-guard fail-safe in `Program.cs` so the API can start outside Development.

**Architecture:** `EntraSession : ISession` lives in `Harmonia.Api.Identity`, reads `HttpContext.User.Claims` via `IHttpContextAccessor`, and is registered Scoped. A two-branch `IsDevelopment()` guard in `Program.cs` keeps dev stubs in Development and activates `Microsoft.Identity.Web` JWT validation + `EntraSession` in all other environments. The `app.UseAuthentication()`/`app.UseAuthorization()` middleware block is placed before all `app.Map*` endpoint registrations.

**Tech Stack:** .NET 8 minimal API, `Microsoft.Identity.Web` 3.x, `IHttpContextAccessor`, JWT bearer (`JwtBearerDefaults.AuthenticationScheme`)

---

### Task 1: Add Microsoft.Identity.Web NuGet package

**Files:**
- Modify: `src/Harmonia.Api/Harmonia.Api.csproj`

**Test-first:** no — package reference change, no behavior to assert; verified by `dotnet build` succeeding

- [ ] **Step 1: Add the PackageReference**

  In `src/Harmonia.Api/Harmonia.Api.csproj`, add inside the existing `<ItemGroup>` that contains `Microsoft.Data.SqlClient`:

  ```xml
  <PackageReference Include="Microsoft.Identity.Web" Version="3.*" />
  ```

  The file should look like:
  ```xml
  <Project Sdk="Microsoft.NET.Sdk.Web">

    <ItemGroup>
      <ProjectReference Include="..\Harmonia.Application\Harmonia.Application.csproj" />
    </ItemGroup>

    <ItemGroup>
      <PackageReference Include="Microsoft.Data.SqlClient" Version="5.2.2" />
      <PackageReference Include="Microsoft.Identity.Web" Version="3.*" />
    </ItemGroup>

  </Project>
  ```

- [ ] **Step 2: Restore and verify build**

  ```
  dotnet build src/Harmonia.Api/Harmonia.Api.csproj
  ```

  Expected: `Build succeeded. 0 Warning(s). 0 Error(s).`

- [ ] **Step 3: Commit**

  ```
  git add src/Harmonia.Api/Harmonia.Api.csproj
  git commit -m "feat: add Microsoft.Identity.Web 3.x to Harmonia.Api"
  ```

---

### Task 2: Add AzureAdB2C placeholder config section

**Files:**
- Modify: `src/Harmonia.Api/appsettings.json`

**Test-first:** no — config section addition with empty values; no secrets; no behavior change in Development

- [ ] **Step 1: Add the AzureAdB2C section**

  In `src/Harmonia.Api/appsettings.json`, add the `AzureAdB2C` object after `"AllowedHosts"`:

  ```json
  {
    "Logging": {
      "LogLevel": {
        "Default": "Information",
        "Microsoft.AspNetCore": "Warning"
      }
    },
    "AllowedHosts": "*",
    "AzureAdB2C": {
      "Instance": "",
      "Domain": "",
      "TenantId": "",
      "ClientId": "",
      "SignUpSignInPolicyId": ""
    },
    "SlotGrid": {
      "SlotKeys": ["DAY"]
    },
    "Session": {
      "IsResident": true,
      "HouseholdRef": "HH-DEV-1"
    },
    "ConnectionStrings": {
      "Reservations": ""
    }
  }
  ```

  All values are empty strings — safe to commit. Real tenant values go in the git-ignored `appsettings.Development.local.json`.

- [ ] **Step 2: Verify the JSON is valid**

  ```
  dotnet build src/Harmonia.Api/Harmonia.Api.csproj
  ```

  Expected: Build succeeds (the API project reads `appsettings.json` at build time for validation).

- [ ] **Step 3: Commit**

  ```
  git add src/Harmonia.Api/appsettings.json
  git commit -m "feat: add AzureAdB2C placeholder config section (empty, no secrets)"
  ```

---

### Task 3: Create EntraSession adapter

**Files:**
- Create: `src/Harmonia.Api/Identity/EntraSession.cs`

**Test-first:** no — per spec: thin adapter with no branching logic beyond claim extraction; mocking `ClaimsPrincipal`/`HttpContext` gives low ROI for a one-line-per-claim read; compile-verified instead

- [ ] **Step 1: Create the Identity folder and EntraSession class**

  Create `src/Harmonia.Api/Identity/EntraSession.cs`:

  ```csharp
  using System.Security.Claims;
  using Harmonia.Application;
  using Harmonia.Domain;
  using ISession = Harmonia.Application.ISession;

  namespace Harmonia.Api.Identity;

  public sealed class EntraSession(IHttpContextAccessor httpContextAccessor) : ISession
  {
      public SessionContext? Resolve()
      {
          var user = httpContextAccessor.HttpContext?.User;
          if (user?.Identity?.IsAuthenticated != true) return null;

          var role = user.FindFirstValue("extension_role");
          var householdClaim = user.FindFirstValue("extension_householdRef");

          return new SessionContext(
              IsResident: role == "resident",
              IsAdmin:    role == "admin",
              HouseholdRef: householdClaim is { Length: > 0 }
                  ? new HouseholdRef(householdClaim)
                  : null);
      }
  }
  ```

  Key invariants encoded:
  - Unauthenticated or null `HttpContext` → returns `null` (same as "no valid session" — R2 upheld).
  - `HouseholdRef` derives from the JWT claim (already validated by middleware) — never from request body/query.
  - `Resolve()` does not log — R3 upheld.

- [ ] **Step 2: Build to verify compilation**

  ```
  dotnet build src/Harmonia.Api/Harmonia.Api.csproj
  ```

  Expected: `Build succeeded. 0 Warning(s). 0 Error(s).`

- [ ] **Step 3: Commit**

  ```
  git add src/Harmonia.Api/Identity/EntraSession.cs
  git commit -m "feat: add EntraSession : ISession — reads extension_householdRef and extension_role from JWT claims"
  ```

---

### Task 4: Restructure Program.cs — remove boot guard, wire two-branch registration, add middleware before endpoints

**Files:**
- Modify: `src/Harmonia.Api/Program.cs`

**Test-first:** yes — run `dotnet test --filter "Category!=Rel"` BEFORE making any changes to confirm all existing unit tests are green; then make the changes; then run again to confirm no regressions. (Rel tests need `HARMONIA_SQL_CONNSTR` and are run separately.)

- [ ] **Step 1: Confirm existing unit tests are green before touching Program.cs**

  ```
  dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --verbosity normal
  ```

  Expected: All tests pass. If any fail, stop and fix before continuing.

- [ ] **Step 2: Rewrite Program.cs with two-branch registration and middleware before Map***

  Replace the current boot guard block (lines 37–54 in the original: the `if (!IsDevelopment()) throw` + the dev stub registration below it) with the two-branch form. The entire rewritten `Program.cs`:

  ```csharp
  using Harmonia.Api.Identity;
  using Harmonia.Api.MaintenanceFees;
  using Harmonia.Api.Reservations;
  using Harmonia.Api.Reservations.Adapters;
  using Harmonia.Application;
  using Harmonia.Application.MaintenanceFees;
  using Harmonia.Application.Reservations;
  using Microsoft.AspNetCore.Authentication.JwtBearer;
  using Microsoft.Identity.Web;
  using ISession = Harmonia.Application.ISession;

  var builder = WebApplication.CreateBuilder(args);

  // Load git-ignored local overrides (connection strings for local dev; never committed).
  builder.Configuration.AddJsonFile("appsettings.Development.local.json", optional: true);

  // The store connection comes from config/env only — never committed (CLAUDE.md).
  var connectionString = builder.Configuration.GetConnectionString("Reservations");
  if (string.IsNullOrWhiteSpace(connectionString))
  {
      throw new InvalidOperationException(
          "ConnectionStrings:Reservations is not configured. Supply it via environment " +
          "(ConnectionStrings__Reservations) or a git-ignored local config file.");
  }

  builder.Services.AddSingleton<IReservationStore>(new SqlReservationStore(connectionString));
  builder.Services.AddSingleton<ISlotGrid>(new ConfigSlotGrid(
      builder.Configuration.GetSection("SlotGrid:SlotKeys").Get<string[]>() ?? ["DAY"]));

  var feeConnString = builder.Configuration.GetConnectionString("MaintenanceFees");
  if (string.IsNullOrWhiteSpace(feeConnString))
  {
      throw new InvalidOperationException(
          "ConnectionStrings:MaintenanceFees is not configured. Supply it via environment " +
          "(ConnectionStrings__MaintenanceFees) or a git-ignored local config file.");
  }
  builder.Services.AddSingleton<IMaintenanceFeeStore>(new SqlMaintenanceFeeStore(feeConnString));

  if (builder.Environment.IsDevelopment())
  {
      // Dev stubs unchanged — config-driven household ref and admin flag.
      if (builder.Configuration.GetValue("Session:IsAdmin", false))
          builder.Services.AddSingleton<ISession>(new DevAdminSession(builder.Environment));
      else
          builder.Services.AddSingleton<ISession>(new DevSession(
              builder.Configuration.GetValue("Session:IsResident", true),
              builder.Configuration.GetValue("Session:HouseholdRef", "HH-DEV-1")!));
  }
  else
  {
      builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
          .AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAdB2C"));
      builder.Services.AddAuthorization();
      builder.Services.AddHttpContextAccessor();
      builder.Services.AddScoped<ISession, EntraSession>();
  }

  builder.Services.AddScoped<GetDayAvailability>();
  builder.Services.AddScoped<ReserveSlot>();
  builder.Services.AddScoped<RecordCharge>();
  builder.Services.AddScoped<ListCharges>();
  builder.Services.AddScoped<ListAllCharges>();

  var app = builder.Build();

  // MUST precede all app.MapGet / app.MapPost calls — middleware pipeline is order-sensitive.
  if (!app.Environment.IsDevelopment())
  {
      app.UseAuthentication();
      app.UseAuthorization();
  }

  app.MapGet(
      "/days/{day}/slots",
      (GetDayAvailability useCase, DateOnly day, ILoggerFactory loggers, CancellationToken ct)
          => ReservationEndpoints.GetDaySlots(useCase, day, loggers.CreateLogger("Reservations"), ct));

  app.MapPost(
      "/days/{day}/slots/{slotKey}/claim",
      (ReserveSlot useCase, DateOnly day, string slotKey, ILoggerFactory loggers, CancellationToken ct)
          => ReservationEndpoints.ClaimSlot(useCase, day, slotKey, loggers.CreateLogger("Reservations"), ct));

  app.MapPost(
      "/maintenance-fees/charges/{householdRef}",
      (RecordCharge useCase, string householdRef, RecordChargeRequest body,
       ILoggerFactory loggers, CancellationToken ct)
          => MaintenanceFeeEndpoints.RecordChargeEndpoint(
              useCase, householdRef, body, loggers.CreateLogger("MaintenanceFees"), ct));

  app.MapGet(
      "/maintenance-fees/charges",
      (ListCharges useCase, ILoggerFactory loggers, CancellationToken ct)
          => MaintenanceFeeEndpoints.ListChargesEndpoint(
              useCase, loggers.CreateLogger("MaintenanceFees"), ct));

  app.MapGet(
      "/maintenance-fees/charges/all",
      (ListAllCharges useCase, ILoggerFactory loggers, CancellationToken ct)
          => MaintenanceFeeEndpoints.ListAllChargesEndpoint(
              useCase, loggers.CreateLogger("MaintenanceFees"), ct));

  app.Run();
  ```

- [ ] **Step 3: Build to verify compilation**

  ```
  dotnet build src/Harmonia.Api/Harmonia.Api.csproj
  ```

  Expected: `Build succeeded. 0 Warning(s). 0 Error(s).`

- [ ] **Step 4: Run unit tests again to confirm no regressions**

  ```
  dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --verbosity normal
  ```

  Expected: All tests pass — same count as Step 1.

  Why tests stay green: unit tests inject `FakeSession`/`FakeAdminSession` directly into use-case and endpoint constructors; they do not go through `Program.cs`. The `IsDevelopment()` branch in `Program.cs` is irrelevant to the unit test host.

- [ ] **Step 5: Commit**

  ```
  git add src/Harmonia.Api/Program.cs
  git commit -m "feat: wire EntraSession + Microsoft.Identity.Web; remove dev-only boot guard (Gap #1 closed)"
  ```

---

## Verification (after all tasks)

Run the full unit test suite one final time:

```
dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --verbosity normal
```

Expected: all pass.

Rel tests (require `HARMONIA_SQL_CONNSTR`):

```
dotnet test tests/Harmonia.IntegrationTests/Harmonia.IntegrationTests.csproj --filter "Category=Rel" --verbosity normal
```

Expected: all pass — Rel tests target the SQL store directly, not the API host or `Program.cs`.

End-to-end verification with a real Entra tenant is a manual step in the deployed environment; it is out of scope for CI.
