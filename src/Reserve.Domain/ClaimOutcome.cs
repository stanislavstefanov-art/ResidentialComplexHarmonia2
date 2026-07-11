namespace Reserve.Domain;

/// <summary>
/// The three observable reserve outcomes (ADR-003 three-outcome contract).
/// Exactly one is always returned; the client never decides success (DA3).
/// </summary>
public enum ClaimOutcome
{
    /// <summary>This household holds the slot — won the race or already held it (C3).</summary>
    ConfirmedYours,

    /// <summary>Another household holds it; the existing hold is untouched (C4, AC-5).</summary>
    RefusedAlreadyTaken,

    /// <summary>Unknown result; the client must re-read the day (C5 → DA4).</summary>
    CouldntConfirm,
}
