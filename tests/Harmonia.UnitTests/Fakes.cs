using Harmonia.Application;
using Harmonia.Application.Counterparties;
using Harmonia.Application.Directory;
using Harmonia.Application.Expenses;
using Harmonia.Application.Financial;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Application.Notifications;
using Harmonia.Application.Payments;
using Harmonia.Application.PendingSignIn;
using Harmonia.Application.Reservations;
using Harmonia.Domain;
using Harmonia.Domain.Counterparties;
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

    // Optional seam: tests can register counterparty display fields for a given
    // CounterpartyId to assert exact joined output; unseeded ids get placeholders.
    public Dictionary<Guid, (string Name, string Category, string ParentCategory)> Counterparties { get; } = [];

    public Task<RecordExpenseResult> RecordExpenseAsync(
        AssociationExpense expense, CancellationToken ct = default)
    {
        if (_byKey.TryGetValue(expense.IdempotencyKey, out var existing))
            return Task.FromResult<RecordExpenseResult>(new RecordExpenseResult.Duplicate(existing));
        _byKey[expense.IdempotencyKey] = expense;
        return Task.FromResult<RecordExpenseResult>(new RecordExpenseResult.Created(expense));
    }

    public Task<IReadOnlyList<ExpenseListItem>> ListExpensesAsync(CancellationToken ct = default)
    {
        var list = _byKey.Values
            .OrderByDescending(e => e.RecordedAt)
            .Select(e =>
            {
                var (name, category, parentCategory) = Counterparties.TryGetValue(e.CounterpartyId, out var cp)
                    ? cp
                    : ("Unknown Counterparty", "Unknown", "Unknown");
                return new ExpenseListItem(
                    e.Id, e.AmountEur, e.Description, e.CounterpartyId,
                    name, category, parentCategory, e.ExpenseDate, e.RecordedAt, e.IdempotencyKey);
            })
            .ToList();
        return Task.FromResult<IReadOnlyList<ExpenseListItem>>(list);
    }

    public Task<AnnualExpenseData> GetAnnualExpensesAsync(int year, CancellationToken ct = default)
        => Task.FromResult(new AnnualExpenseData([]));
}

public sealed class FailingExpenseStore : IExpenseStore
{
    public Task<RecordExpenseResult> RecordExpenseAsync(
        AssociationExpense expense, CancellationToken ct = default)
        => Task.FromResult<RecordExpenseResult>(new RecordExpenseResult.Failed());

    public Task<IReadOnlyList<ExpenseListItem>> ListExpensesAsync(CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<AnnualExpenseData> GetAnnualExpensesAsync(int year, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");
}

public sealed class FakeCounterpartyStore : ICounterpartyStore
{
    private readonly Dictionary<Guid, Counterparty> _byId = [];

    // Phase 1: no bills FK exists yet, so nothing is ever "in use". Flip to true in a
    // specific test to exercise the HasBills path without a real FK.
    public HashSet<Guid> WithBills { get; } = [];

    public Task<IReadOnlyList<Counterparty>> ListAsync(CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<Counterparty>>(
            _byId.Values.OrderBy(c => c.Name).ToList());

    public Task<Counterparty?> GetAsync(Guid id, CancellationToken ct = default)
    {
        _byId.TryGetValue(id, out var cp);
        return Task.FromResult(cp);
    }

    public Task<Counterparty> CreateAsync(
        string name, string category, string parentCategory,
        string? vatNumber, string? phone, string? email, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var cp = new Counterparty(Guid.NewGuid(), name, category, parentCategory, vatNumber, phone, email, now, now);
        _byId[cp.Id] = cp;
        return Task.FromResult(cp);
    }

    public Task<UpdateCounterpartyStoreResult> UpdateAsync(
        Guid id, string name, string category, string parentCategory,
        string? vatNumber, string? phone, string? email, CancellationToken ct = default)
    {
        if (!_byId.TryGetValue(id, out var existing))
            return Task.FromResult<UpdateCounterpartyStoreResult>(new UpdateCounterpartyStoreResult.NotFound());
        var updated = existing with
        {
            Name = name, Category = category, ParentCategory = parentCategory,
            VatNumber = vatNumber, Phone = phone, Email = email, UpdatedAt = DateTimeOffset.UtcNow
        };
        _byId[id] = updated;
        return Task.FromResult<UpdateCounterpartyStoreResult>(new UpdateCounterpartyStoreResult.Ok(updated));
    }

    public Task<DeleteCounterpartyStoreResult> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        if (!_byId.ContainsKey(id))
            return Task.FromResult<DeleteCounterpartyStoreResult>(new DeleteCounterpartyStoreResult.NotFound());
        if (WithBills.Contains(id))
            return Task.FromResult<DeleteCounterpartyStoreResult>(new DeleteCounterpartyStoreResult.HasBills());
        _byId.Remove(id);
        return Task.FromResult<DeleteCounterpartyStoreResult>(new DeleteCounterpartyStoreResult.Ok());
    }
}

public sealed class FailingCounterpartyStore : ICounterpartyStore
{
    public Task<IReadOnlyList<Counterparty>> ListAsync(CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<Counterparty?> GetAsync(Guid id, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<Counterparty> CreateAsync(
        string name, string category, string parentCategory,
        string? vatNumber, string? phone, string? email, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<UpdateCounterpartyStoreResult> UpdateAsync(
        Guid id, string name, string category, string parentCategory,
        string? vatNumber, string? phone, string? email, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<DeleteCounterpartyStoreResult> DeleteAsync(Guid id, CancellationToken ct = default)
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

    public Task<IReadOnlyList<HouseholdRef>> GetAllHouseholdRefsAsync(CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<HouseholdRef>>(_subs.Keys.ToList());

    /// Seeded by tests; GetAdminHouseholdRefsAsync returns exactly these.
    public List<HouseholdRef> AdminRefs { get; } = [];

    public Task<IReadOnlyList<HouseholdRef>> GetAdminHouseholdRefsAsync(CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<HouseholdRef>>(AdminRefs.ToList());
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

    public Task<IReadOnlyList<HouseholdRef>> GetAllHouseholdRefsAsync(CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<IReadOnlyList<HouseholdRef>> GetAdminHouseholdRefsAsync(CancellationToken ct = default)
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
        HouseholdRef householdRef, string role, string? displayName, string? phone, string? email,
        bool? isOptedOut, CancellationToken ct = default)
    {
        var idx = _contacts.FindIndex(c => c.HouseholdRef == householdRef && c.Role == role);
        if (idx >= 0)
        {
            var e = _contacts[idx];
            _contacts[idx] = e with
            {
                DisplayName = displayName ?? e.DisplayName,
                Phone       = phone       ?? e.Phone,
                Email       = email       ?? e.Email,
                IsOptedOut  = isOptedOut  ?? e.IsOptedOut,
                UpdatedAt   = DateTimeOffset.UtcNow
            };
        }
        else
        {
            _contacts.Add(new HouseholdContact(
                householdRef, role, displayName, phone, email, null,
                isOptedOut ?? false, DateTimeOffset.UtcNow, null));
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
                householdRef, "Owner", null, null, null, notes, false, DateTimeOffset.UtcNow, null));
        }
        return Task.FromResult<UpdateNotesResult>(new UpdateNotesResult.Ok());
    }

    public Task<EraseContactResult> DeleteContactAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
    {
        var idx = _contacts.FindIndex(c => c.HouseholdRef == householdRef);
        if (idx < 0) return Task.FromResult<EraseContactResult>(new EraseContactResult.NotFound());
        _contacts.RemoveAt(idx);
        return Task.FromResult<EraseContactResult>(new EraseContactResult.Ok());
    }

    public Task<MarkDepartedResult> MarkDepartedAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
    {
        var idx = _contacts.FindIndex(c => c.HouseholdRef == householdRef);
        if (idx < 0) return Task.FromResult<MarkDepartedResult>(new MarkDepartedResult.NotFound());
        var c = _contacts[idx];
        _contacts[idx] = c with { DepartedAt = c.DepartedAt ?? DateTimeOffset.UtcNow };
        return Task.FromResult<MarkDepartedResult>(new MarkDepartedResult.Ok());
    }

    public Task<PurgeExpiredContactsResult> PurgeExpiredContactsAsync(CancellationToken ct = default)
    {
        var cutoff  = DateTimeOffset.UtcNow.AddYears(-1);
        var removed = _contacts.RemoveAll(c => c.DepartedAt.HasValue && c.DepartedAt.Value < cutoff);
        return Task.FromResult<PurgeExpiredContactsResult>(new PurgeExpiredContactsResult.Ok(removed));
    }

    public Task<HouseholdContact?> GetContactAsync(HouseholdRef householdRef, string role, CancellationToken ct = default)
    {
        var contact = _contacts.FirstOrDefault(c => c.HouseholdRef == householdRef && c.Role == role);
        return Task.FromResult<HouseholdContact?>(contact);
    }

    public Task<RemoveResidentResult> RemoveResidentAsync(
        HouseholdRef householdRef, string role, CancellationToken ct = default)
    {
        var removed = _contacts.RemoveAll(c => c.HouseholdRef == householdRef && c.Role == role);
        return Task.FromResult<RemoveResidentResult>(
            removed > 0 ? new RemoveResidentResult.Ok() : new RemoveResidentResult.NotFound());
    }
}

public sealed class FailingDirectoryStore : IDirectoryStore
{
    public Task<IReadOnlyList<HouseholdContact>> ListAllAsync(CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<UpdateContactResult> UpsertContactAsync(
        HouseholdRef householdRef, string role, string? displayName, string? phone, string? email,
        bool? isOptedOut, CancellationToken ct = default)
        => Task.FromResult<UpdateContactResult>(new UpdateContactResult.Failed());

    public Task<UpdateNotesResult> UpsertNotesAsync(
        HouseholdRef householdRef, string? notes, CancellationToken ct = default)
        => Task.FromResult<UpdateNotesResult>(new UpdateNotesResult.Failed());

    public Task<EraseContactResult> DeleteContactAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
        => Task.FromResult<EraseContactResult>(new EraseContactResult.Failed());

    public Task<MarkDepartedResult> MarkDepartedAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
        => Task.FromResult<MarkDepartedResult>(new MarkDepartedResult.Failed());

    public Task<PurgeExpiredContactsResult> PurgeExpiredContactsAsync(CancellationToken ct = default)
        => Task.FromResult<PurgeExpiredContactsResult>(new PurgeExpiredContactsResult.Failed());

    public Task<HouseholdContact?> GetContactAsync(HouseholdRef householdRef, string role, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<RemoveResidentResult> RemoveResidentAsync(
        HouseholdRef householdRef, string role, CancellationToken ct = default)
        => Task.FromResult<RemoveResidentResult>(new RemoveResidentResult.Failed());
}

// Slice 1 fake — only UpsertAsync is exercised; the 3 new methods throw so they're never called from Slice 1 tests.
public sealed class FakePendingSignInStore : IPendingSignInStore
{
    public List<(string Oid, string Email, string DisplayName)> UpsertCalls { get; } = [];

    /// What the next UpsertAsync reports. Defaults to Inserted so existing tests,
    /// which only assert that the call happened, keep their meaning.
    public PendingUpsertResult NextUpsertResult { get; set; } = PendingUpsertResult.Inserted;

    public Task<PendingUpsertResult> UpsertAsync(string oid, string email, string displayName, CancellationToken ct = default)
    {
        UpsertCalls.Add((oid, email, displayName));
        return Task.FromResult(NextUpsertResult);
    }

    public Task<IReadOnlyList<PendingSignIn>> ListAsync(CancellationToken ct = default)
        => throw new NotSupportedException("Use FakePendingSignInStoreV2 for Slice 2 tests.");

    public Task<ActivateResult> ActivateAsync(string oid, string householdRef, string role, CancellationToken ct = default)
        => throw new NotSupportedException("Use FakePendingSignInStoreV2 for Slice 2 tests.");

    public Task<int> PurgeExpiredAsync(DateTimeOffset olderThan, CancellationToken ct = default)
        => throw new NotSupportedException("Use FakePendingSignInStoreV2 for Slice 2 tests.");

    public Task<DirectLinkResult> DirectLinkAsync(string oid, string householdRef, string role, CancellationToken ct = default)
        => throw new NotSupportedException("Use FakePendingSignInStoreV2 for Slice 2 tests.");
}

public sealed class FailingPendingSignInStore : IPendingSignInStore
{
    public Task<PendingUpsertResult> UpsertAsync(string oid, string email, string displayName, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<IReadOnlyList<PendingSignIn>> ListAsync(CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<ActivateResult> ActivateAsync(string oid, string householdRef, string role, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<int> PurgeExpiredAsync(DateTimeOffset olderThan, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<DirectLinkResult> DirectLinkAsync(string oid, string householdRef, string role, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");
}

// Slice 2 fake — full implementation; used by ListPendingSignIns, ActivatePendingSignIn,
// PurgeExpiredPendingSignIns use case tests and AdminPendingEndpoints tests.
public sealed class FakePendingSignInStoreV2 : IPendingSignInStore
{
    public List<PendingSignIn> Pending { get; init; } = [];
    public HashSet<string> AlreadyActivated { get; } = [];
    public HashSet<(string HouseholdRef, string Role)> TakenRoles { get; } = [];
    public List<(string Oid, string HouseholdRef, string Role)> ActivateCalls { get; } = [];
    public List<(string Oid, string Email, string DisplayName)> UpsertCalls { get; } = [];
    public int PurgeCalls { get; private set; }
    public PendingUpsertResult NextUpsertResult { get; set; } = PendingUpsertResult.Inserted;

    public Task<PendingUpsertResult> UpsertAsync(string oid, string email, string displayName, CancellationToken ct = default)
    {
        UpsertCalls.Add((oid, email, displayName));
        return Task.FromResult(NextUpsertResult);
    }

    public Task<IReadOnlyList<PendingSignIn>> ListAsync(CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<PendingSignIn>>(Pending.ToList());

    public Task<ActivateResult> ActivateAsync(string oid, string householdRef, string role, CancellationToken ct = default)
    {
        if (AlreadyActivated.Contains(oid))
            return Task.FromResult(ActivateResult.AlreadyActivated);
        var pending = Pending.FirstOrDefault(p => p.EntraObjectId == oid);
        if (pending is null) return Task.FromResult(ActivateResult.NotFound);
        if (TakenRoles.Contains((householdRef, role)))
            return Task.FromResult(ActivateResult.RoleConflict);
        ActivateCalls.Add((oid, householdRef, role));
        Pending.Remove(pending);
        TakenRoles.Add((householdRef, role));
        return Task.FromResult(ActivateResult.Ok);
    }

    public Task<int> PurgeExpiredAsync(DateTimeOffset olderThan, CancellationToken ct = default)
    {
        PurgeCalls++;
        var removed = Pending.RemoveAll(p => p.FirstSeenAt < olderThan);
        return Task.FromResult(removed);
    }

    public List<(string Oid, string HouseholdRef, string Role)> DirectLinkCalls { get; } = [];
    public bool DirectLinkAlreadyLinked { get; set; }

    public Task<DirectLinkResult> DirectLinkAsync(string oid, string householdRef, string role, CancellationToken ct = default)
    {
        if (DirectLinkAlreadyLinked)
            return Task.FromResult(DirectLinkResult.AlreadyLinked);
        DirectLinkCalls.Add((oid, householdRef, role));
        return Task.FromResult(DirectLinkResult.Ok);
    }
}

public sealed class FakeHouseholdByOidLookup(
    string? householdRef, string role = "Owner", bool isAdmin = false) : IHouseholdByOidLookup
{
    public List<(string Oid, bool IsAdmin)> SetAdminFlagCalls { get; } = [];

    public Task<HouseholdLink?> FindAsync(string oid, CancellationToken ct = default)
        => Task.FromResult(householdRef is null ? null : new HouseholdLink(householdRef, role, isAdmin));

    public Task SetAdminFlagAsync(string oid, bool isAdmin, CancellationToken ct = default)
    {
        SetAdminFlagCalls.Add((oid, isAdmin));
        return Task.CompletedTask;
    }
}

public sealed class FakeInvoiceScanner(ScannedInvoice result) : IInvoiceScanner
{
    /// A scan that analysed the document but matched no invoice fields.
    public static FakeInvoiceScanner FindingNothing() => new(new ScannedInvoice(null, null, null, null));

    public bool WasCalled { get; private set; }

    public Task<ScannedInvoice> ScanAsync(Stream fileStream, string contentType, CancellationToken ct)
    {
        WasCalled = true;
        return Task.FromResult(result);
    }
}

public sealed class FakeNewPendingSignInQueue : INewPendingSignInQueue
{
    private readonly Queue<NewPendingSignIn> _queue = new();
    private readonly object _gate = new();
    private TaskCompletionSource<NewPendingSignIn>? _waiter;

    public List<NewPendingSignIn> Enqueued { get; } = [];

    public void Enqueue(NewPendingSignIn signal)
    {
        Enqueued.Add(signal);
        lock (_gate)
        {
            if (_waiter is { Task.IsCompleted: false } waiter)
            {
                _waiter = null;
                waiter.TrySetResult(signal);
                return;
            }
            _queue.Enqueue(signal);
        }
    }

    public async ValueTask<NewPendingSignIn> DequeueAsync(CancellationToken ct)
    {
        TaskCompletionSource<NewPendingSignIn> waiter;
        lock (_gate)
        {
            if (_queue.Count > 0) return _queue.Dequeue();
            waiter = new TaskCompletionSource<NewPendingSignIn>(TaskCreationOptions.RunContinuationsAsynchronously);
            _waiter = waiter;
        }

        // Genuinely waits for cancellation rather than throwing eagerly, so callers
        // (PendingSignInNotifier's tests) exercise the real graceful-shutdown branch
        // instead of racing a busy-loop against StopAsync.
        await using var registration = ct.Register(() => waiter.TrySetCanceled(ct));
        return await waiter.Task;
    }

    public int DrainPending()
    {
        lock (_gate)
        {
            var drained = _queue.Count;
            _queue.Clear();
            return drained;
        }
    }
}
