namespace Harmonia.Domain.Reservations;

/// <summary>
/// Discriminated result of the store's atomic conditional claim (LA-500-4, ADR-0002).
/// The store decides the race; the app only maps this result — it never re-checks (R1).
/// </summary>
public enum ClaimResult
{
    /// <summary>This write set the holder — the caller won the race.</summary>
    Claimed,

    /// <summary>A holder already existed and it is the caller (idempotent retry, R2).</summary>
    AlreadyHeldByMe,

    /// <summary>A holder already existed and it is another household — the caller lost.</summary>
    AlreadyHeldByOther,

    /// <summary>Timeout / connection / unknown store error; no evidence of mutation.</summary>
    Unavailable,
}
