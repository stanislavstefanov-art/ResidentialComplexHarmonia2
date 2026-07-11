using Harmonia.Domain;
using Harmonia.Domain.Reservations;

namespace Harmonia.Application.Reservations;

/// <summary>One slot of the day view (AC-1).</summary>
public sealed record SlotView(string SlotKey, SlotState State);

/// <summary>Result of the availability read: refused (AC-6) or the day's slots.</summary>
public abstract record AvailabilityResult
{
    private AvailabilityResult() { }

    /// <summary>No valid resident session — no slot data is returned (AC-6, NFR-3).</summary>
    public sealed record Refused : AvailabilityResult;

    public sealed record Ok(DateOnly Day, IReadOnlyList<SlotView> Slots) : AvailabilityResult;
}

/// <summary>
/// Use case: view a day's availability (US-1). Residency-gated; state is derived from
/// the authoritative store read at request time — no availability cache (NFR-2, ADR-002).
/// </summary>
public sealed class GetDayAvailability(ISession session, ISlotGrid grid, IReservationStore store)
{
    private readonly ISession _session = session;
    private readonly ISlotGrid _grid = grid;
    private readonly IReservationStore _store = store;

    public async Task<AvailabilityResult> ExecuteAsync(DateOnly day, CancellationToken ct = default)
    {
        var ctx = _session.Resolve();
        if (ctx is not { IsResident: true })
        {
            return new AvailabilityResult.Refused(); // AC-6: no data for non-residents
        }

        var slotKeys = _grid.ForDay(day);
        var holders = await _store.GetDayHoldersAsync(day, ct);

        var slots = slotKeys
            .Select(key => new SlotView(
                key,
                SlotStateDeriver.Derive(
                    holders.TryGetValue(key, out var holder) ? holder : null,
                    ctx.HouseholdRef)))
            .ToList();

        return new AvailabilityResult.Ok(day, slots);
    }
}
