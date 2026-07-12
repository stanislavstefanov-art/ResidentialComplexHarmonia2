namespace Harmonia.Domain.Expenses;

public sealed record AssociationExpense(
    Guid           Id,
    decimal        AmountEur,
    string         Description,
    string         Category,
    DateOnly       ExpenseDate,
    DateTimeOffset RecordedAt,
    string         IdempotencyKey);
