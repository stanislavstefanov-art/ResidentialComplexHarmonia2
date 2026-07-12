using Harmonia.Application;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Application.Reservations;
using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;
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

/// <summary>In-memory fake maintenance fee store for unit tests.</summary>
public sealed class FakeMaintenanceFeeStore : IMaintenanceFeeStore
{
    private readonly Dictionary<(HouseholdRef, string), MaintenanceFeeCharge> _byKey = [];
    private readonly Dictionary<HouseholdRef, List<MaintenanceFeeCharge>> _byHousehold = [];

    public List<MaintenanceFeeCharge> RecordedCharges { get; } = [];

    public Task<RecordChargeResult> RecordChargeAsync(MaintenanceFeeCharge charge, CancellationToken ct = default)
    {
        var key = (charge.HouseholdRef, charge.IdempotencyKey);
        if (_byKey.TryGetValue(key, out var existing))
            return Task.FromResult<RecordChargeResult>(new RecordChargeResult.Duplicate(existing));

        _byKey[key] = charge;
        if (!_byHousehold.TryGetValue(charge.HouseholdRef, out var list))
            _byHousehold[charge.HouseholdRef] = list = [];
        list.Add(charge);
        RecordedCharges.Add(charge);
        return Task.FromResult<RecordChargeResult>(new RecordChargeResult.Created(charge));
    }

    public Task<IReadOnlyList<MaintenanceFeeCharge>> ListChargesAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
    {
        var charges = _byHousehold.TryGetValue(householdRef, out var list)
            ? (IReadOnlyList<MaintenanceFeeCharge>)list.OrderByDescending(c => c.ChargedAt).ToList()
            : [];
        return Task.FromResult(charges);
    }

    public Task<IReadOnlyList<MaintenanceFeeCharge>> ListAllChargesAsync(CancellationToken ct = default)
    {
        var all = _byHousehold.Values
            .SelectMany(x => x)
            .OrderBy(c => c.HouseholdRef.Value)
            .ThenByDescending(c => c.ChargedAt)
            .ToList();
        return Task.FromResult<IReadOnlyList<MaintenanceFeeCharge>>(all);
    }
}

/// <summary>
/// Store that simulates failure: RecordChargeAsync returns Failed, ListChargesAsync throws.
/// Used to unit-test the Failed result paths in use cases.
/// </summary>
public sealed class FailingMaintenanceFeeStore : IMaintenanceFeeStore
{
    public Task<RecordChargeResult> RecordChargeAsync(MaintenanceFeeCharge charge, CancellationToken ct = default)
        => Task.FromResult<RecordChargeResult>(new RecordChargeResult.Failed());

    public Task<IReadOnlyList<MaintenanceFeeCharge>> ListChargesAsync(HouseholdRef householdRef, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<IReadOnlyList<MaintenanceFeeCharge>> ListAllChargesAsync(CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");
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
