using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.Application.Directory;

public abstract record GetDirectoryResult
{
    private GetDirectoryResult() { }
    public sealed record Refused                                               : GetDirectoryResult;
    public sealed record ResidentView(IReadOnlyList<HouseholdContact> Entries) : GetDirectoryResult;
    public sealed record BoardView(IReadOnlyList<HouseholdContact> Entries)    : GetDirectoryResult;
    public sealed record Failed                                                : GetDirectoryResult;
}

public abstract record UpdateContactResult
{
    private UpdateContactResult() { }
    public sealed record Refused : UpdateContactResult;
    public sealed record Ok      : UpdateContactResult;
    public sealed record Failed  : UpdateContactResult;
}

public abstract record UpdateNotesResult
{
    private UpdateNotesResult() { }
    public sealed record Refused : UpdateNotesResult;
    public sealed record Ok      : UpdateNotesResult;
    public sealed record Failed  : UpdateNotesResult;
}

public interface IDirectoryStore
{
    Task<IReadOnlyList<HouseholdContact>> ListAllAsync(CancellationToken ct = default);

    Task<UpdateContactResult> UpsertContactAsync(
        HouseholdRef householdRef,
        string?      displayName,
        string?      phone,
        string?      email,
        CancellationToken ct = default);

    Task<UpdateNotesResult> UpsertNotesAsync(
        HouseholdRef householdRef,
        string?      notes,
        CancellationToken ct = default);
}
