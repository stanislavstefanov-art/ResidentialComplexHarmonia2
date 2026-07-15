using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Application.Expenses;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Application.Notifications;
using Harmonia.Application.Payments;
using Harmonia.Application.Reservations;
using Harmonia.Domain;
using Harmonia.Domain.Directory;
using Harmonia.Domain.Expenses;
using Harmonia.Domain.MaintenanceFees;
using Harmonia.Domain.Notifications;
using Harmonia.Domain.Payments;
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

public sealed class FakeExpenseStore : IExpenseStore
{
    private readonly Dictionary<string, AssociationExpense> _byKey = [];

    public Task<RecordExpenseResult> RecordExpenseAsync(
        AssociationExpense expense, CancellationToken ct = default)
    {
        if (_byKey.TryGetValue(expense.IdempotencyKey, out var existing))
            return Task.FromResult<RecordExpenseResult>(new RecordExpenseResult.Duplicate(existing));
        _byKey[expense.IdempotencyKey] = expense;
        return Task.FromResult<RecordExpenseResult>(new RecordExpenseResult.Created(expense));
    }

    public Task<IReadOnlyList<AssociationExpense>> ListExpensesAsync(CancellationToken ct = default)
    {
        var list = _byKey.Values.OrderByDescending(e => e.RecordedAt).ToList();
        return Task.FromResult<IReadOnlyList<AssociationExpense>>(list);
    }
}

public sealed class FailingExpenseStore : IExpenseStore
{
    public Task<RecordExpenseResult> RecordExpenseAsync(
        AssociationExpense expense, CancellationToken ct = default)
        => Task.FromResult<RecordExpenseResult>(new RecordExpenseResult.Failed());

    public Task<IReadOnlyList<AssociationExpense>> ListExpensesAsync(CancellationToken ct = default)
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

    public Task<IReadOnlyList<HouseholdRef>> GetDayBookingHoldersAsync(
        DateOnly day, CancellationToken ct = default)
    {
        var holders = Holders.Values.Distinct().ToList();
        return Task.FromResult<IReadOnlyList<HouseholdRef>>(holders);
    }
}

public sealed class FakePaymentStore : IPaymentStore
{
    private readonly Dictionary<(HouseholdRef, string), MaintenanceFeePayment> _byKey = [];
    private readonly Dictionary<HouseholdRef, List<MaintenanceFeePayment>> _byHousehold = [];

    public Task<RecordPaymentResult> RecordPaymentAsync(
        MaintenanceFeePayment payment, CancellationToken ct = default)
    {
        var key = (payment.HouseholdRef, payment.IdempotencyKey);
        if (_byKey.TryGetValue(key, out var existing))
            return Task.FromResult<RecordPaymentResult>(new RecordPaymentResult.Duplicate(existing));

        _byKey[key] = payment;
        if (!_byHousehold.TryGetValue(payment.HouseholdRef, out var list))
            _byHousehold[payment.HouseholdRef] = list = [];
        list.Add(payment);
        return Task.FromResult<RecordPaymentResult>(new RecordPaymentResult.Created(payment));
    }

    public Task<IReadOnlyList<MaintenanceFeePayment>> ListPaymentsByHouseholdAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
    {
        var payments = _byHousehold.TryGetValue(householdRef, out var list)
            ? (IReadOnlyList<MaintenanceFeePayment>)list.OrderByDescending(p => p.DateReceived).ToList()
            : [];
        return Task.FromResult(payments);
    }

    public Task<IReadOnlyList<MaintenanceFeePayment>> ListAllPaymentsAsync(
        CancellationToken ct = default)
    {
        var all = _byHousehold.Values
            .SelectMany(x => x)
            .OrderBy(p => p.HouseholdRef.Value)
            .ThenByDescending(p => p.DateReceived)
            .ToList();
        return Task.FromResult<IReadOnlyList<MaintenanceFeePayment>>(all);
    }
}

public sealed class FailingPaymentStore : IPaymentStore
{
    public Task<RecordPaymentResult> RecordPaymentAsync(
        MaintenanceFeePayment payment, CancellationToken ct = default)
        => Task.FromResult<RecordPaymentResult>(new RecordPaymentResult.Failed());

    public Task<IReadOnlyList<MaintenanceFeePayment>> ListPaymentsByHouseholdAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<IReadOnlyList<MaintenanceFeePayment>> ListAllPaymentsAsync(
        CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");
}

/// <summary>Records all calls; never throws. DispatchCalls keyed by kind.</summary>
public sealed class FakeNotificationStore : INotificationStore
{
    private readonly Dictionary<HouseholdRef, PushSubscription> _subs = [];
    private readonly List<NotificationRecord> _history = [];

    public Task<SaveSubscriptionResult> SaveSubscriptionAsync(
        PushSubscription sub, CancellationToken ct = default)
    {
        var isNew = !_subs.ContainsKey(sub.HouseholdRef);
        var stored = isNew ? sub : sub with { CreatedAt = _subs[sub.HouseholdRef].CreatedAt };
        _subs[sub.HouseholdRef] = stored;
        return Task.FromResult<SaveSubscriptionResult>(
            new SaveSubscriptionResult.Saved(stored, isNew));
    }

    public Task<RemoveSubscriptionResult> RemoveSubscriptionAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
    {
        if (!_subs.Remove(householdRef))
            return Task.FromResult<RemoveSubscriptionResult>(new RemoveSubscriptionResult.NotFound());
        return Task.FromResult<RemoveSubscriptionResult>(new RemoveSubscriptionResult.Removed());
    }

    public Task<PushSubscription?> GetSubscriptionAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
    {
        _subs.TryGetValue(householdRef, out var sub);
        return Task.FromResult(sub);
    }

    public Task<IReadOnlyList<PushSubscription>> ListAllSubscriptionsAsync(CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<PushSubscription>>(_subs.Values.ToList());

    public Task AppendHistoryAsync(NotificationRecord record, CancellationToken ct = default)
    {
        _history.Add(record);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<NotificationRecord>> GetHistoryAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
    {
        var cutoff = DateTimeOffset.UtcNow.AddDays(-30);
        var result = _history
            .Where(r => r.HouseholdRef == householdRef && r.SentAt >= cutoff)
            .OrderByDescending(r => r.SentAt)
            .ToList();
        return Task.FromResult<IReadOnlyList<NotificationRecord>>(result);
    }
}

public sealed class FailingNotificationStore : INotificationStore
{
    public Task<SaveSubscriptionResult> SaveSubscriptionAsync(
        PushSubscription sub, CancellationToken ct = default)
        => Task.FromResult<SaveSubscriptionResult>(new SaveSubscriptionResult.Failed());

    public Task<RemoveSubscriptionResult> RemoveSubscriptionAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
        => Task.FromResult<RemoveSubscriptionResult>(new RemoveSubscriptionResult.Failed());

    public Task<PushSubscription?> GetSubscriptionAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<IReadOnlyList<PushSubscription>> ListAllSubscriptionsAsync(CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task AppendHistoryAsync(NotificationRecord record, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<IReadOnlyList<NotificationRecord>> GetHistoryAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");
}

/// <summary>Records dispatch calls; never throws.</summary>
public sealed class FakeNotificationDispatcher : INotificationDispatcher
{
    public List<(NotificationKind Kind, HouseholdRef HouseholdRef)> DispatchCalls { get; } = [];
    public List<(string Title, string Body)> BroadcastCalls { get; } = [];

    public Task DispatchAsync(NotificationKind kind, HouseholdRef householdRef, CancellationToken ct = default)
    {
        DispatchCalls.Add((kind, householdRef));
        return Task.CompletedTask;
    }

    public Task BroadcastAsync(string title, string body, CancellationToken ct = default)
    {
        BroadcastCalls.Add((title, body));
        return Task.CompletedTask;
    }
}

public sealed class FailingNotificationDispatcher : INotificationDispatcher
{
    public Task DispatchAsync(NotificationKind kind, HouseholdRef householdRef, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated dispatcher failure");

    public Task BroadcastAsync(string title, string body, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated dispatcher failure");
}

public sealed class FakeDirectoryStore : IDirectoryStore
{
    private readonly List<HouseholdContact> _contacts = [];

    public List<HouseholdContact> Contacts => _contacts;

    public Task<IReadOnlyList<HouseholdContact>> ListAllAsync(CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<HouseholdContact>>([.. _contacts]);

    public Task<UpdateContactResult> UpsertContactAsync(
        HouseholdRef householdRef, string? displayName, string? phone, string? email,
        CancellationToken ct = default)
    {
        var idx = _contacts.FindIndex(c => c.HouseholdRef == householdRef);
        if (idx >= 0)
        {
            var e = _contacts[idx];
            _contacts[idx] = e with
            {
                DisplayName = displayName ?? e.DisplayName,
                Phone       = phone       ?? e.Phone,
                Email       = email       ?? e.Email,
                UpdatedAt   = DateTimeOffset.UtcNow
            };
        }
        else
        {
            _contacts.Add(new HouseholdContact(
                householdRef, displayName, phone, email, null, IsOptedOut: false, DateTimeOffset.UtcNow));
        }
        return Task.FromResult<UpdateContactResult>(new UpdateContactResult.Ok());
    }

    public Task<UpdateNotesResult> UpsertNotesAsync(
        HouseholdRef householdRef, string? notes, CancellationToken ct = default)
    {
        var idx = _contacts.FindIndex(c => c.HouseholdRef == householdRef);
        if (idx >= 0)
        {
            var e = _contacts[idx];
            _contacts[idx] = e with { Notes = notes, UpdatedAt = DateTimeOffset.UtcNow };
        }
        else
        {
            _contacts.Add(new HouseholdContact(
                householdRef, null, null, null, notes, IsOptedOut: false, DateTimeOffset.UtcNow));
        }
        return Task.FromResult<UpdateNotesResult>(new UpdateNotesResult.Ok());
    }
}

public sealed class FailingDirectoryStore : IDirectoryStore
{
    public Task<IReadOnlyList<HouseholdContact>> ListAllAsync(CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<UpdateContactResult> UpsertContactAsync(
        HouseholdRef householdRef, string? displayName, string? phone, string? email,
        CancellationToken ct = default)
        => Task.FromResult<UpdateContactResult>(new UpdateContactResult.Failed());

    public Task<UpdateNotesResult> UpsertNotesAsync(
        HouseholdRef householdRef, string? notes, CancellationToken ct = default)
        => Task.FromResult<UpdateNotesResult>(new UpdateNotesResult.Failed());
}
