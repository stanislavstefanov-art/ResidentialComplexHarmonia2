using Harmonia.Application;
using ISession = Harmonia.Application.ISession;

namespace Harmonia.Api.Reservations.Adapters;

/// <summary>
/// Dev-only admin identity stand-in. Admin role is an open gap (context/cold/gap-log.md, Gap #4):
/// the real IdP adapter must close ADR-0001 gate #6 before any admin path goes to prod.
/// Refuses to boot outside Development so it can never slip into a non-dev environment.
/// Admins have no apartment; HouseholdRef is null by design (R2 does not apply to action targets).
/// </summary>
public sealed class DevAdminSession : ISession
{
    public DevAdminSession(IHostEnvironment env)
    {
        if (!env.IsDevelopment())
            throw new InvalidOperationException(
                "DevAdminSession is a dev-only admin stand-in (context/cold/gap-log.md Gap #4); " +
                "refusing to start outside Development until a real admin ISession adapter exists.");
    }

    public SessionContext? Resolve()
        => new(IsResident: false, IsAdmin: true, HouseholdRef: null);
}
