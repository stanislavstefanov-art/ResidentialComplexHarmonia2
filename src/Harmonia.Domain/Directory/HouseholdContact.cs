namespace Harmonia.Domain.Directory;

public sealed record HouseholdContact(
    HouseholdRef   HouseholdRef,
    string?        DisplayName,
    string?        Phone,
    string?        Email,
    string?        Notes,
    DateTimeOffset UpdatedAt);
