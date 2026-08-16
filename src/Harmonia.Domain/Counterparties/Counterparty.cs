namespace Harmonia.Domain.Counterparties;

public sealed record Counterparty(
    Guid           Id,
    string         Name,
    string         Category,
    string         ParentCategory,
    string?        VatNumber,
    string?        Phone,
    string?        Email,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
