using Harmonia.Application;
using ISession = Harmonia.Application.ISession;

namespace Harmonia.Api.Reservations.Adapters;

/// <summary>
/// Dev-only stand-in that presents an authenticated-but-unlinked (pending) caller.
/// Use Session:Mode = DevPending in appsettings.Development.json to exercise the
/// pending-middleware and GET /me flows locally without a real Entra token.
/// Refuses to boot outside Development so it can never slip into a non-dev environment.
/// </summary>
public sealed class DevPendingSession : ISession
{
    public DevPendingSession(IHostEnvironment env)
    {
        if (!env.IsDevelopment())
            throw new InvalidOperationException(
                "DevPendingSession is a dev-only pending-state stand-in; " +
                "refusing to start outside Development.");
    }

    public SessionContext? Resolve()
        => new(IsResident: false, IsAdmin: false, HouseholdRef: null,
               EntraObjectId: "dev-pending-oid", IsPending: true);
}
