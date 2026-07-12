# EntraSession ISession Adapter — Design

**Status:** Approved (autonomous spec.approved — tech-lead-reviewer)
**ADR:** ADR-0003 (Microsoft Entra External ID)
**Closes:** Gap #1

## Goal

Replace the `IsDevelopment()` fail-safe boot guard in `Program.cs` with a proper two-path registration: real `EntraSession` adapter in non-Development environments, dev stubs retained in Development. No change to `ISession`, `SessionContext`, or any domain/application layer.

## Architecture

The `ISession` port stays in `Harmonia.Application` unchanged. The new adapter lives in `Harmonia.Api` — specifically `src/Harmonia.Api/Identity/EntraSession.cs` — to keep identity adapters separate from the Reservations-namespace adapters where the dev stubs currently live (eventual cleanup out of scope here).

### `EntraSession`

```csharp
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

Key invariants:
- Unauthenticated or null `HttpContext` → returns `null` (same as "no valid session").
- Claim names are string constants — never hardcoded strings in use-case or domain code.
- R2 upheld: `HouseholdRef` derives from the JWT claim (already validated by middleware), never from request body/query.
- R3 upheld: `Resolve()` does not log.

### `Program.cs` restructure

The current unconditional `throw` guard (`if (!builder.Environment.IsDevelopment()) throw`) is removed and replaced with two branches:

```csharp
if (builder.Environment.IsDevelopment())
{
    // Dev stubs unchanged — config-driven household ref and admin flag
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
    builder.Services.AddAuthorization();          // required by UseAuthorization middleware
    builder.Services.AddHttpContextAccessor();
    builder.Services.AddScoped<ISession, EntraSession>();
}
```

After `app.Build()` and **before any `app.Map*` endpoint registrations**, add the middleware:

```csharp
// MUST precede all app.MapGet / app.MapPost calls — middleware pipeline is order-sensitive.
if (!app.Environment.IsDevelopment())
{
    app.UseAuthentication();
    app.UseAuthorization();
}
```

The `app.Map*` endpoint registrations follow the authentication middleware block.

### `appsettings.json` addition

```json
{
  "AzureAdB2C": {
    "Instance": "",
    "Domain": "",
    "TenantId": "",
    "ClientId": "",
    "SignUpSignInPolicyId": ""
  }
}
```

Values are empty strings — safe to commit (no secrets). Local dev config (`appsettings.Development.local.json`, git-ignored) can override if needed for manual Entra tenant testing.

### NuGet package

`Microsoft.Identity.Web` added to `Harmonia.Api.csproj`:

```xml
<PackageReference Include="Microsoft.Identity.Web" Version="3.*" />
```

Version 3.x is compatible with .NET 8 and supports `AddMicrosoftIdentityWebApi`.

## Testing approach

`EntraSession` itself is **not unit-tested** — it is a thin adapter over `IHttpContextAccessor` with no branching logic beyond claim extraction. Testing it in isolation requires mocking ASP.NET Core's `ClaimsPrincipal`/`HttpContext`, which provides low ROI for what is essentially a one-line claim read.

Existing tests are unaffected:
- Unit tests use `FakeSession` / `FakeAdminSession` (already injectable via `ISession`) — no change.
- Rel integration tests use `FakeSession` injected directly — no change.
- The `IsDevelopment()` guard change does not affect test-project isolation.

End-to-end verification (real Entra tenant) is a manual step in the deployed environment; it is not part of the CI suite.

## Behaviour change

Removing the boot guard means the API can now start outside Development. This is intentional — `EntraSession` + `Microsoft.Identity.Web` middleware IS the production identity plane. The old guard was a temporary safety net; removing it is the closure of Gap #1.

## Out of scope

- Moving dev stubs out of `Harmonia.Api.Reservations.Adapters` namespace (cosmetic, separate PR).
- E2E tests with a real Entra tenant (infrastructure concern, not a code task).
- Updating `Session.cs` docstring comments (done in the same commit as `EntraSession`).
