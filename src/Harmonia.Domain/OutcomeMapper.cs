namespace Harmonia.Domain.Reservations;

/// <summary>
/// Pure mapping from the store's claim result to the observable outcome (500 plan §mapOutcome).
/// Upholds: idempotent self-retry is a success, never a false refusal (R2);
/// an unknown store result never fabricates success (DA3).
/// </summary>
public static class OutcomeMapper
{
    public static ClaimOutcome Map(ClaimResult result)
        => result switch
        {
            ClaimResult.Claimed => ClaimOutcome.ConfirmedYours,
            ClaimResult.AlreadyHeldByMe => ClaimOutcome.ConfirmedYours,
            ClaimResult.AlreadyHeldByOther => ClaimOutcome.RefusedAlreadyTaken,
            ClaimResult.Unavailable => ClaimOutcome.CouldntConfirm,
            _ => ClaimOutcome.CouldntConfirm,
        };
}
