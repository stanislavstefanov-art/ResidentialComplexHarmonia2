using Harmonia.Application.Reservations;
using Harmonia.Domain.Reservations;

namespace Harmonia.UnitTests;

/// <summary>Fake session adapter — the IdP behind ISession is an open gap (gap-log).</summary>
public sealed class FakeSession(SessionContext? context) : ISession
{
    public SessionContext? Resolve() => context;
}

public sealed class FakeSlotGrid(params string[] slotKeys) : ISlotGrid
{
    public IReadOnlyList<string> ForDay(DateOnly day) => slotKeys;
}

/// <summary>
/// Recording in-memory store for unit tests only. The claim result is scripted;
/// the real atomic behaviour is proven against SQL Server in the integration tier.
/// </summary>
public sealed class RecordingStore : IReservationStore
{
    public Dictionary<string, HouseholdRef> Holders { get; } = [];
    public ClaimResult NextClaimResult { get; set; } = ClaimResult.Claimed;

    public int GetDayHoldersCalls { get; private set; }
    public List<(DateOnly Day, string SlotKey, HouseholdRef HouseholdRef)> ClaimCalls { get; } = [];

    public Task<IReadOnlyDictionary<string, HouseholdRef>> GetDayHoldersAsync(
        DateOnly day, CancellationToken ct = default)
    {
        GetDayHoldersCalls++;
        return Task.FromResult<IReadOnlyDictionary<string, HouseholdRef>>(Holders);
    }

    public Task<ClaimResult> ClaimSlotAsync(
        DateOnly day, string slotKey, HouseholdRef householdRef, CancellationToken ct = default)
    {
        ClaimCalls.Add((day, slotKey, householdRef));
        return Task.FromResult(NextClaimResult);
    }
}
