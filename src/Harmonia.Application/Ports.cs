using Harmonia.Domain.Reservations;

namespace Harmonia.Application.Reservations;

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

/// <summary>
/// The reservation store port — the only place SQL lives (architecture.md).
/// <see cref="ClaimSlotAsync"/> is the atomic conditional claim: the store decides the
/// race in one write; callers must never read-then-write around it (R1, ADR-0002).
/// </summary>
public interface IReservationStore
{
    Task<IReadOnlyDictionary<string, HouseholdRef>> GetDayHoldersAsync(
        DateOnly day, CancellationToken ct = default);

    Task<ClaimResult> ClaimSlotAsync(
        DateOnly day, string slotKey, HouseholdRef householdRef, CancellationToken ct = default);
}

/// <summary>
/// The configured slot grid for a day (PA1/G1: grid is data, never hard-coded).
/// v1 ships one slot per day; hourly slots are a config/data change (stack.md).
/// </summary>
public interface ISlotGrid
{
    IReadOnlyList<string> ForDay(DateOnly day);
}
