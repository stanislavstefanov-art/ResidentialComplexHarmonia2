namespace Harmonia.Domain.MaintenanceFees;

/// <summary>
/// An immutable, append-only maintenance fee charge record.
/// No edit or delete; the ledger only grows.
/// </summary>
public sealed record MaintenanceFeeCharge(
    Guid Id,
    HouseholdRef HouseholdRef,
    decimal AmountEur,
    string Description,
    string Period,
    DateTimeOffset ChargedAt,
    string IdempotencyKey);
