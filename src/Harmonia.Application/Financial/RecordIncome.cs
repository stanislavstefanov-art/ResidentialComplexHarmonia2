using Harmonia.Domain.Financial;

namespace Harmonia.Application.Financial;

public sealed class RecordIncome(ISession session, IIncomeStore store)
{
    public async Task<RecordIncomeResult> ExecuteAsync(
        string category,
        string description,
        decimal amountEur,
        DateOnly incomeDate,
        string idempotencyKey,
        CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new RecordIncomeResult.Refused();

        var income = new AssociationIncome(
            Id:             Guid.NewGuid(),
            Category:       category,
            Description:    description,
            AmountEur:      amountEur,
            IncomeDate:     incomeDate,
            RecordedAt:     DateTimeOffset.UtcNow,
            IdempotencyKey: idempotencyKey);

        return await store.RecordIncomeAsync(income, ct);
    }
}
