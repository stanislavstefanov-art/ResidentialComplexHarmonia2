using Harmonia.Application.Reservations;

namespace Harmonia.Api.Reservations.Adapters;

/// <summary>
/// The slot grid as configuration (PA1/G1: the grid is data, never hard-coded).
/// v1 ships one slot per day; moving to hourly slots is a config change, and the
/// unique key already carries (day, slotKey) so no migration is needed (stack.md).
/// </summary>
public sealed class ConfigSlotGrid(IReadOnlyList<string> slotKeys) : ISlotGrid
{
    public IReadOnlyList<string> ForDay(DateOnly day) => slotKeys;
}
