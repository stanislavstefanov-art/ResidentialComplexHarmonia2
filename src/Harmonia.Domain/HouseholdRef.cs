namespace Harmonia.Domain;

/// <summary>
/// Opaque reference to the household that holds (or requests) a reservation.
/// EU personal data (R3): must never be written to logs or error messages.
/// </summary>
public readonly record struct HouseholdRef(string Value);
