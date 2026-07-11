using Harmonia.Domain;

namespace Harmonia.Domain.Reservations;

/// <summary>
/// Pure derivation of a slot's state from its holder and the viewing resident (AC-1).
/// No I/O; the holder comes from the authoritative store read at request time.
/// </summary>
public static class SlotStateDeriver
{
    public static SlotState Derive(HouseholdRef? holder, HouseholdRef me)
        => holder is null ? SlotState.Free
         : holder == me ? SlotState.TakenMine
         : SlotState.TakenOther;
}
