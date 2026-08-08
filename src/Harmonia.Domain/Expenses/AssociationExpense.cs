namespace Harmonia.Domain.Expenses;

public sealed record AssociationExpense(
    Guid           Id,
    decimal        AmountEur,
    string         Description,
    string         Category,
    string?        ParentCategory,
    DateOnly       ExpenseDate,
    DateTimeOffset RecordedAt,
    string         IdempotencyKey);
