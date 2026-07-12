using Harmonia.Domain.Expenses;

namespace Harmonia.Application.Expenses;

public sealed class RecordExpense(ISession session, IExpenseStore store)
{
    public async Task<RecordExpenseResult> ExecuteAsync(
        decimal amountEur,
        string description,
        string category,
        DateOnly expenseDate,
        string idempotencyKey,
        CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new RecordExpenseResult.Refused();

        var expense = new AssociationExpense(
            Id:             Guid.NewGuid(),
            AmountEur:      amountEur,
            Description:    description,
            Category:       category,
            ExpenseDate:    expenseDate,
            RecordedAt:     DateTimeOffset.UtcNow,
            IdempotencyKey: idempotencyKey);

        return await store.RecordExpenseAsync(expense, ct);
    }
}
