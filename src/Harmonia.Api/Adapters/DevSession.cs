using Harmonia.Application;
using Harmonia.Domain;
using ISession = Harmonia.Application.ISession;

namespace Harmonia.Api.Reservations.Adapters;

/// <summary>
/// Dev-only stand-in for the identity seam. The concrete IdP behind ISession is an
/// open, human-owned gap (context/cold/gap-log.md, ADR-0001 gate #6): this adapter
/// yields a fixed "verified session" from local config so the slice can run.
/// Swapping it for the real IdP adapter must touch NOTHING in Domain/Application.
/// NEVER derive identity from a request body/query/header here or anywhere (R2).
/// </summary>
public sealed class DevSession(bool isResident, string householdRef) : ISession
{
    public SessionContext? Resolve()
        => new(IsResident: isResident, IsAdmin: false, HouseholdRef: new HouseholdRef(householdRef));
}
