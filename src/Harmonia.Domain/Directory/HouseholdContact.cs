namespace Harmonia.Domain.Directory;

/// <summary>
/// Snapshot of one apartment's contact information stored in <c>dbo.HouseholdContacts</c>.
/// Phone and Email are personal data (R3) — never log their values; log counts or opaque refs only.
/// </summary>
public sealed record HouseholdContact(
    HouseholdRef   HouseholdRef,
    string?        DisplayName,
    string?        Phone,
    string?        Email,
    string?        Notes,
    bool           IsOptedOut,
    DateTimeOffset UpdatedAt);
