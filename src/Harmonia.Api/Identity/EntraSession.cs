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
