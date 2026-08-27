namespace Harmonia.Domain.Directory;

/// <summary>
/// Snapshot of one resident's contact information stored in <c>dbo.HouseholdContacts</c>.
/// Keyed per person (EntraObjectId), not per (HouseholdRef, Role) — a household can have
/// more than one resident sharing the same role. Phone, Email, HouseholdRef, and
/// EntraObjectId are personal data (R3) — never log their values; log counts or opaque
/// refs only.
/// </summary>
public sealed record HouseholdContact(
    HouseholdRef    HouseholdRef,
    string          Role,
    string?         DisplayName,
    string?         Phone,
    string?         Email,
    string?         Notes,
    bool            IsOptedOut,
    DateTimeOffset  UpdatedAt,
    DateTimeOffset? DepartedAt,
    string          EntraObjectId);
