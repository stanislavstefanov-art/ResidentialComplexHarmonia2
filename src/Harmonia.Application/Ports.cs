using Harmonia.Domain;
using Harmonia.Domain.Reservations;

namespace Harmonia.Application.Reservations;

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

    // Returns one HouseholdRef per distinct household with a booking on the given day.
    Task<IReadOnlyList<HouseholdRef>> GetDayBookingHoldersAsync(DateOnly day, CancellationToken ct = default);
}

/// <summary>
/// The configured slot grid for a day (PA1/G1: grid is data, never hard-coded).
/// v1 ships one slot per day; hourly slots are a config/data change (stack.md).
/// </summary>
public interface ISlotGrid
{
    IReadOnlyList<string> ForDay(DateOnly day);
}
