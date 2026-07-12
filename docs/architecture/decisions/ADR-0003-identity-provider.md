# ADR-0003 — Identity Provider: Microsoft Entra External ID

**Status:** Accepted
**Closes:** Gap #1 (gap-log.md) — concrete IdP deferred in ADR-0001
**Date:** 2026-07-12

## Context

ADR-0001 established the trust-root principle (R2: household ref derives from the
verified session only, never the request body) and deferred the concrete IdP to a
human gate. Two authentication requirements now exist before the first non-dev
deployment:

1. **Social login** — residents with a Google (or Microsoft) account should be able
   to sign in without creating a new credential.
2. **Local accounts** — residents with no social account need an email + password
   path. The app must never store passwords itself.

Constraints: single-cloud Azure (ADR-0001 context), free tier while proving the
idea, invite-only (accounts are created by the admin and bound to an apartment, not
self-registered).

## Decision

**Microsoft Entra External ID** (formerly Azure AD B2C) is the identity provider.

- **Social logins:** Google OAuth 2.0, Microsoft account, Apple — configured as
  identity providers in the Entra External ID tenant. No additional code in the app.
- **Local accounts:** email + password managed entirely by Entra. The app never
  receives or stores passwords; Entra handles hashing, reset flows, and lockout.
- **Invite-only:** the admin creates the user record in the Entra tenant and sets
  the `householdRef` custom attribute. Users cannot self-register.
- **Claims:** the JWT Entra issues carries:
  - `extension_householdRef` (string | absent) — the apartment identifier;
    null/absent for admin accounts.
  - `extension_role` (string) — `resident` or `admin`.
- **Free tier:** 50,000 Monthly Active Users at no cost. A residential complex
  requires ≤ 100 accounts.

### API adapter

`Microsoft.Identity.Web` validates the Entra JWT in the Azure Functions isolated
host. The real `ISession` implementation reads from `HttpContext.User.Claims`:

```csharp
public SessionContext? Resolve()
{
    var principal = _httpContext.User;
    if (principal?.Identity?.IsAuthenticated != true) return null;

    var role = principal.FindFirstValue("extension_role");
    var householdClaim = principal.FindFirstValue("extension_householdRef");

    var isAdmin = role == "admin";
    var isResident = role == "resident";
    var household = householdClaim is { Length: > 0 }
        ? new HouseholdRef(householdClaim) : (HouseholdRef?)null;

    return new SessionContext(IsResident: isResident, IsAdmin: isAdmin,
        HouseholdRef: household);
}

DevSession and DevAdminSession remain for local development only
(IsDevelopment() guard in Program.cs). No Entra tenant is required to run
tests or develop locally.

Blazor WASM adapter

MSAL.js (@azure/msal-browser) acquires tokens via the SPA authorization code +
PKCE flow. The access token is attached to every API request as
Authorization: Bearer <token>. The API validates the signature and claims; the
browser never makes trust decisions (R2).

Consequences

- Gap #1 closed: the identity seam is no longer deferred; all three gap-log
entries that referenced "real IdP" resolve once the Entra tenant is configured
and the real ISession adapter ships.
- Gap #4 resolved by convention: admin accounts have no extension_householdRef
claim. The adapter returns HouseholdRef: null for admins. Entra enforces this
by not setting the attribute on admin user records.
- Tenant setup is manual: Entra External ID tenant configuration (user flows,
social IdP registration, custom attributes) is a one-time manual step in the
Azure portal. It is not yet in IaC; this is acceptable for pre-pilot.
- Local dev unchanged: DevSession/DevAdminSession stubs are kept behind the
IsDevelopment() guard. All unit and Rel tests continue to run without an Entra
tenant.
- Vendor alignment: Entra External ID is Azure-native, consistent with the
single-cloud commitment. No cross-cloud identity plane is introduced.

Alternatives considered

┌─────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│               Option                │                                                                    Rejected because                                                                    │
├─────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Auth0                               │ Free tier (7,500 MAU) is adequate, but Auth0 is not Azure-native — introduces a cross-cloud identity plane inconsistent with the single-cloud strategy │
├─────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Azure Static Web Apps built-in auth │ No local accounts, no invite-only workflow, no custom claims — covers social login only                                                                │
├─────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Custom username/password            │ Never: password storage (hashing, salting, reset, lockout) is undifferentiated security risk; a managed IdP handles this correctly and for free        │
├─────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Keycloak (self-hosted)              │ Self-hosted adds VM cost and ops burden; no free-tier path on Azure that matches the near-zero cost target                                             │
└─────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘