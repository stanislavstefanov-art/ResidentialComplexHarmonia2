namespace Harmonia.Domain.Financial;

public sealed record AssociationIncome(
    Guid           Id,
    string         Category,
    string         Description,
    decimal        AmountEur,
    DateOnly       IncomeDate,
    DateTimeOffset RecordedAt,
    string         IdempotencyKey);
