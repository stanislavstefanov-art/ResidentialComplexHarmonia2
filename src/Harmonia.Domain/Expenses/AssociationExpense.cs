namespace Harmonia.Domain.Expenses;

public sealed record AssociationExpense(
    Guid           Id,
    decimal        AmountEur,
    string         Description,
    Guid           CounterpartyId,
    DateOnly       ExpenseDate,
    DateTimeOffset RecordedAt,
    string         IdempotencyKey);
