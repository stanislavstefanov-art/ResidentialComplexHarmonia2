using System.Security.Claims;
using Harmonia.Application;
using Harmonia.Application.PendingSignIn;
using Harmonia.Domain;
using ISession = Harmonia.Application.ISession;

namespace Harmonia.Api.Identity;

public sealed class EntraSession(
    IHttpContextAccessor  httpContextAccessor,
    IPendingSignInStore   pendingStore,
    IHouseholdByOidLookup householdLookup) : ISession
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
            return new SessionContext(IsResident: false, IsAdmin: true,
                HouseholdRef: null, EntraObjectId: oid, IsPending: false);

        var link = await householdLookup.FindAsync(oid);
        if (link is not null)
            return new SessionContext(IsResident: true, IsAdmin: false,
                HouseholdRef: new HouseholdRef(link.HouseholdRef),
                EntraObjectId: oid, IsPending: false, Role: link.Role);

        var email       = user.FindFirstValue("email") ?? string.Empty;
        var displayName = user.FindFirstValue(ClaimTypes.Name)
                       ?? user.FindFirstValue("name") ?? string.Empty;
        await pendingStore.UpsertAsync(oid, email, displayName);
        return new SessionContext(IsResident: false, IsAdmin: false,
            HouseholdRef: null, EntraObjectId: oid, IsPending: true);
    }
}
