using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;

namespace Harmonia.Application.MaintenanceFees;

/// <summary>
/// Use case: an admin records a maintenance fee charge for a household.
/// Target household comes from the route parameter — it is the action target, not the actor's
/// identity (documented R2 exception on admin POST). The actor's identity is verified via
/// IsAdmin from the session; a non-admin or missing session is refused immediately.
/// </summary>
public sealed class RecordCharge(ISession session, IMaintenanceFeeStore store)
{
    public async Task<RecordChargeResult> ExecuteAsync(
        HouseholdRef targetHousehold,
        decimal amountEur,
        string description,
        string period,
        string idempotencyKey,
        CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new RecordChargeResult.Refused();

        var charge = new MaintenanceFeeCharge(
            Id: Guid.NewGuid(),
            HouseholdRef: targetHousehold,
            AmountEur: amountEur,
            Description: description,
            Period: period,
            ChargedAt: DateTimeOffset.UtcNow,
            IdempotencyKey: idempotencyKey);

        return await store.RecordChargeAsync(charge, ct);
    }
}
