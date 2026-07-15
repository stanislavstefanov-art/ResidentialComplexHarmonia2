using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.Application.Directory;

/// <summary>Role-differentiated outcome of <see cref="GetDirectory"/>.</summary>
public abstract record GetDirectoryResult
{
    private GetDirectoryResult() { }
    /// <summary>No valid session or insufficient role.</summary>
    public sealed record Refused                                               : GetDirectoryResult;
    /// <summary>Resident view — name and apartment only, no PII.</summary>
    public sealed record ResidentView(IReadOnlyList<HouseholdContact> Entries) : GetDirectoryResult;
    /// <summary>Board view — full contact details including phone, email, and notes.</summary>
    public sealed record BoardView(IReadOnlyList<HouseholdContact> Entries)    : GetDirectoryResult;
    /// <summary>Store error; details are in the server log.</summary>
    public sealed record Failed                                                : GetDirectoryResult;
}

/// <summary>Outcome of updating a household's contact fields.</summary>
public abstract record UpdateContactResult
{
    private UpdateContactResult() { }
    /// <summary>No valid session or insufficient role.</summary>
    public sealed record Refused : UpdateContactResult;
    public sealed record Ok      : UpdateContactResult;
    /// <summary>Store error; details are in the server log.</summary>
    public sealed record Failed  : UpdateContactResult;
}

/// <summary>Outcome of updating a household's operational notes.</summary>
public abstract record UpdateNotesResult
{
    private UpdateNotesResult() { }
    /// <summary>No valid session or insufficient role.</summary>
    public sealed record Refused : UpdateNotesResult;
    public sealed record Ok      : UpdateNotesResult;
    /// <summary>Store error; details are in the server log.</summary>
    public sealed record Failed  : UpdateNotesResult;
}

/// <summary>
/// Directory store port — SQL adapter lives in <c>Harmonia.Api.Reservations.Adapters</c>.
/// R3: <paramref name="phone"/> and <paramref name="email"/> values must never appear in log output;
/// implementations must log only exception types and opaque identifiers.
/// </summary>
public interface IDirectoryStore
{
    Task<IReadOnlyList<HouseholdContact>> ListAllAsync(CancellationToken ct = default);

    /// <summary>
    /// Upserts display name, phone, email, and opt-out flag for <paramref name="householdRef"/>.
    /// Passing <see langword="null"/> for any field preserves the existing stored value (COALESCE semantics).
    /// R3: never log <paramref name="phone"/> or <paramref name="email"/> values.
    /// </summary>
    Task<UpdateContactResult> UpsertContactAsync(
        HouseholdRef householdRef,
        string?      displayName,
        string?      phone,
        string?      email,
        bool?        isOptedOut,
        CancellationToken ct = default);

    /// <summary>
    /// Upserts the operational notes for <paramref name="householdRef"/>.
    /// Passing <see langword="null"/> clears existing notes.
    /// </summary>
    Task<UpdateNotesResult> UpsertNotesAsync(
        HouseholdRef householdRef,
        string?      notes,
        CancellationToken ct = default);
}
