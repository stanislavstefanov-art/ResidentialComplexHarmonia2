using Harmonia.Domain;

namespace Harmonia.Application;

/// <summary>
/// Resolves the verified upstream session (ADR-0001). Returns null when there is no
/// valid session. The household reference comes ONLY from here — never from a request
/// body, query, or header (R2). The concrete IdP behind this port is an open gap
/// (context/cold/gap-log.md); the build wires a fake adapter. A real adapter should
/// verify the token in auth middleware (Api layer) and let Resolve() read the
/// already-verified scoped result synchronously — keeping this port sync.
/// </summary>
public interface ISession
{
    SessionContext? Resolve();
}

/// <summary>The identity a verified session yields (ADR-0001).</summary>
public sealed record SessionContext(bool IsResident, HouseholdRef HouseholdRef);
