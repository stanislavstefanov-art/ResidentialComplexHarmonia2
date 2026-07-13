using Harmonia.Application.Notifications;
using Harmonia.Domain;
using Harmonia.Domain.Payments;

namespace Harmonia.Application.Payments;

public sealed class RecordPayment(ISession session, IPaymentStore store, INotificationDispatcher dispatcher)
{
    public async Task<RecordPaymentResult> ExecuteAsync(
        string householdRef,
        decimal amountEur,
        string period,
        DateOnly dateReceived,
        string idempotencyKey,
        CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new RecordPaymentResult.Refused();

        var payment = new MaintenanceFeePayment(
            Id:             Guid.NewGuid(),
            HouseholdRef:   new HouseholdRef(householdRef),
            AmountEur:      amountEur,
            Period:         period,
            DateReceived:   dateReceived,
            RecordedAt:     DateTimeOffset.UtcNow,
            IdempotencyKey: idempotencyKey);

        var result = await store.RecordPaymentAsync(payment, ct);
        if (result is RecordPaymentResult.Created created)
            _ = dispatcher.DispatchAsync(NotificationKind.PaymentRecorded, created.Payment.HouseholdRef, ct);
        return result;
    }
}
