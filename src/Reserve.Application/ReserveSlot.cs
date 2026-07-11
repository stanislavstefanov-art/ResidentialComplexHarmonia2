using Reserve.Domain;

namespace Reserve.Application;

/// <summary>Result of a reserve attempt, as the API layer must render it.</summary>
public abstract record ReserveResult
{
    private ReserveResult() { }

    /// <summary>No valid resident session — nothing is read or written (AC-6).</summary>
    public sealed record Refused : ReserveResult;

    /// <summary>Slot key not in the day's configured grid — not a claim attempt (T10).</summary>
    public sealed record UnknownSlot : ReserveResult;

    /// <summary>One of the three observable outcomes (ADR-003).</summary>
    public sealed record Outcome(ClaimOutcome Value) : ReserveResult;
}

/// <summary>
/// Use case: claim a free slot (US-2/US-3). The load-bearing call is the single atomic
/// <see cref="IReservationStore.ClaimSlotAsync"/> — the store decides the race (R1);
/// there is deliberately no availability pre-check on this path (no read-then-write).
/// The household is taken ONLY from the verified session (R2) — this method has no
/// household parameter by construction.
/// </summary>
public sealed class ReserveSlot(ISession session, ISlotGrid grid, IReservationStore store)
{
    private readonly ISession _session = session;
    private readonly ISlotGrid _grid = grid;
    private readonly IReservationStore _store = store;

    public async Task<ReserveResult> ExecuteAsync(DateOnly day, string slotKey, CancellationToken ct = default)
    {
        var ctx = _session.Resolve();
        if (ctx is not { IsResident: true })
        {
            return new ReserveResult.Refused(); // AC-6: no reservation is created
        }

        if (!_grid.ForDay(day).Contains(slotKey))
        {
            return new ReserveResult.UnknownSlot(); // not a claim attempt
        }

        // THE load-bearing line (R1): one atomic conditional write; the store decides
        // the race. No availability pre-check here — that would reopen the TOCTOU gap.
        var result = await _store.ClaimSlotAsync(day, slotKey, ctx.HouseholdRef, ct);

        return new ReserveResult.Outcome(OutcomeMapper.Map(result));
    }
}
