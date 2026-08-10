using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.Application.Households;

public interface IHouseholdStore
{
    Task<IReadOnlyList<Household>> ListAsync(CancellationToken ct = default);
    Task<UpsertHouseholdResult> UpsertAsync(HouseholdRef householdRef, decimal sqMeters, CancellationToken ct = default);
    Task<DeleteHouseholdResult> DeleteAsync(HouseholdRef householdRef, CancellationToken ct = default);
}

public abstract record UpsertHouseholdResult
{
    private UpsertHouseholdResult() { }
    public sealed record Ok       : UpsertHouseholdResult;
    public sealed record Refused  : UpsertHouseholdResult;
    public sealed record Failed   : UpsertHouseholdResult;
}

public abstract record GetHouseholdsResult
{
    private GetHouseholdsResult() { }
    public sealed record Ok(IReadOnlyList<Household> Households) : GetHouseholdsResult;
    public sealed record Refused                                  : GetHouseholdsResult;
    public sealed record Failed                                   : GetHouseholdsResult;
}

public abstract record DeleteHouseholdResult
{
    private DeleteHouseholdResult() { }
    public sealed record Ok       : DeleteHouseholdResult;
    public sealed record NotFound : DeleteHouseholdResult;
    public sealed record Refused  : DeleteHouseholdResult;
    public sealed record Failed   : DeleteHouseholdResult;
}
