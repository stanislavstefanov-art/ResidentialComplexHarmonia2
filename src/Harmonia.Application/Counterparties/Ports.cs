using Harmonia.Domain.Counterparties;

namespace Harmonia.Application.Counterparties;

public interface ICounterpartyStore
{
    Task<IReadOnlyList<Counterparty>> ListAsync(CancellationToken ct = default);
    Task<Counterparty?> GetAsync(Guid id, CancellationToken ct = default);
    Task<Counterparty> CreateAsync(
        string name, string category, string parentCategory,
        string? vatNumber, string? phone, string? email, CancellationToken ct = default);
    Task<UpdateCounterpartyStoreResult> UpdateAsync(
        Guid id, string name, string category, string parentCategory,
        string? vatNumber, string? phone, string? email, CancellationToken ct = default);
    Task<DeleteCounterpartyStoreResult> DeleteAsync(Guid id, CancellationToken ct = default);
}

// Store-level results (no auth concept — the use case owns Refused).
public abstract record UpdateCounterpartyStoreResult
{
    private UpdateCounterpartyStoreResult() { }
    public sealed record Ok(Counterparty Counterparty) : UpdateCounterpartyStoreResult;
    public sealed record NotFound                        : UpdateCounterpartyStoreResult;
}

public abstract record DeleteCounterpartyStoreResult
{
    private DeleteCounterpartyStoreResult() { }
    public sealed record Ok       : DeleteCounterpartyStoreResult;
    public sealed record HasBills : DeleteCounterpartyStoreResult; // Phase 2 activates this; Phase 1 never returns it.
    public sealed record NotFound : DeleteCounterpartyStoreResult;
}

// Use-case-level results (include Refused for the admin gate + Failed for infra errors).
public abstract record ListCounterpartiesResult
{
    private ListCounterpartiesResult() { }
    public sealed record Refused                                     : ListCounterpartiesResult;
    public sealed record Ok(IReadOnlyList<Counterparty> Counterparties) : ListCounterpartiesResult;
    public sealed record Failed                                      : ListCounterpartiesResult;
}

public abstract record CreateCounterpartyResult
{
    private CreateCounterpartyResult() { }
    public sealed record Refused                          : CreateCounterpartyResult;
    public sealed record Created(Counterparty Counterparty) : CreateCounterpartyResult;
    public sealed record Failed                           : CreateCounterpartyResult;
}

public abstract record GetCounterpartyResult
{
    private GetCounterpartyResult() { }
    public sealed record Refused                      : GetCounterpartyResult;
    public sealed record Ok(Counterparty Counterparty) : GetCounterpartyResult;
    public sealed record NotFound                     : GetCounterpartyResult;
    public sealed record Failed                       : GetCounterpartyResult;
}

public abstract record UpdateCounterpartyResult
{
    private UpdateCounterpartyResult() { }
    public sealed record Refused                      : UpdateCounterpartyResult;
    public sealed record Ok(Counterparty Counterparty) : UpdateCounterpartyResult;
    public sealed record NotFound                     : UpdateCounterpartyResult;
    public sealed record Failed                       : UpdateCounterpartyResult;
}

public abstract record DeleteCounterpartyResult
{
    private DeleteCounterpartyResult() { }
    public sealed record Refused  : DeleteCounterpartyResult;
    public sealed record Ok       : DeleteCounterpartyResult;
    public sealed record HasBills : DeleteCounterpartyResult;
    public sealed record NotFound : DeleteCounterpartyResult;
    public sealed record Failed   : DeleteCounterpartyResult;
}
