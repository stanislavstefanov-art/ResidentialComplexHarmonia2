using System.Security.Claims;
using Harmonia.Application;
using Harmonia.Application.PendingSignIn;
using Harmonia.Domain;
using Microsoft.Extensions.Logging;
using ISession = Harmonia.Application.ISession;

namespace Harmonia.Api.Identity;

public sealed class EntraSession(
    IHttpContextAccessor  httpContextAccessor,
    IPendingSignInStore   pendingStore,
    IHouseholdByOidLookup householdLookup,
    ILogger<EntraSession> logger) : ISession
{
    private SessionContext? _cached;
    private bool _resolved;

    public SessionContext? Resolve()
    {
        if (_resolved) return _cached;
        _cached = ResolveCore().GetAwaiter().GetResult();
        _resolved = true;
        return _cached;
    }

    private async Task<SessionContext?> ResolveCore()
    {
        var user = httpContextAccessor.HttpContext?.User;
        if (user?.Identity?.IsAuthenticated != true) return null;

        var oid = user.FindFirstValue("oid")
               ?? user.FindFirstValue("http://schemas.microsoft.com/identity/claims/objectidentifier");
        if (oid is null) return null;

        if (user.IsInRole("admin"))
        {
            var adminLink = await householdLookup.FindAsync(oid);
            // Mirror the token's claim so background work, which has no token, can
            // find admins. Written only on disagreement: this runs on every request.
            // A failed mirror write must never fail authentication for an otherwise
            // valid caller — the flag simply stays stale until the next request.
            // Two concurrent requests from the same newly-admin OID can both attempt
            // this write; both converge on the same value, so that race is harmless.
            if (adminLink is { IsAdmin: false })
                await TrySetAdminFlagAsync(oid, true);
            return new SessionContext(IsResident: false, IsAdmin: true,
                HouseholdRef: adminLink is not null ? new HouseholdRef(adminLink.HouseholdRef) : null,
                EntraObjectId: oid, IsPending: false, Role: adminLink?.Role);
        }

        var link = await householdLookup.FindAsync(oid);
        if (link is not null)
        {
            // The token no longer says admin: clear a stale flag so a revoked admin
            // stops receiving admin notifications.
            if (link.IsAdmin)
                await TrySetAdminFlagAsync(oid, false);
            return new SessionContext(IsResident: true, IsAdmin: false,
                HouseholdRef: new HouseholdRef(link.HouseholdRef),
                EntraObjectId: oid, IsPending: false, Role: link.Role);
        }

        var email       = user.FindFirstValue("email") ?? string.Empty;
        var displayName = user.FindFirstValue(ClaimTypes.Name)
                       ?? user.FindFirstValue("name") ?? string.Empty;
        await pendingStore.UpsertAsync(oid, email, displayName);
        return new SessionContext(IsResident: false, IsAdmin: false,
            HouseholdRef: null, EntraObjectId: oid, IsPending: true);
    }

    // R3: oid is personal data — never log its value.
    private async Task TrySetAdminFlagAsync(string oid, bool isAdmin)
    {
        try
        {
            await householdLookup.SetAdminFlagAsync(oid, isAdmin);
        }
        catch (Exception)
        {
            logger.LogWarning("Failed to mirror the admin flag; will retry on the next request");
        }
    }
}
