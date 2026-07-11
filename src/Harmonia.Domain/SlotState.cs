namespace Harmonia.Domain.Reservations;

/// <summary>Per-slot availability state as seen by one resident (AC-1).</summary>
public enum SlotState
{
    Free,
    TakenMine,
    TakenOther,
}
