namespace Harmonia.Domain.Payments;

public sealed record MaintenanceFeePayment(
    Guid           Id,
    HouseholdRef   HouseholdRef,
    decimal        AmountEur,
    string         Period,
    DateOnly       DateReceived,
    DateTimeOffset RecordedAt,
    string         IdempotencyKey);
