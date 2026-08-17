using Microsoft.AspNetCore.Http;
using Harmonia.Application.Counterparties;
using Harmonia.Domain.Counterparties;

namespace Harmonia.Api.Counterparties;

public sealed record CounterpartyRequest(
    string  Name,
    string  Category,
    string  ParentCategory,
    string? VatNumber,
    string? Phone,
    string? Email);

public sealed record CounterpartyDto(
    Guid           Id,
    string         Name,
    string         Category,
    string         ParentCategory,
    string?        VatNumber,
    string?        Phone,
    string?        Email,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public static class CounterpartyEndpoints
{
    public static async Task<IResult> ListCounterpartiesEndpoint(
        ListCounterparties useCase, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(ct);
        return result switch
        {
            ListCounterpartiesResult.Refused => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            ListCounterpartiesResult.Ok ok   => TypedResults.Ok(ok.Counterparties.Select(ToDto).ToList()),
            ListCounterpartiesResult.Failed  => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                                => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    public static async Task<IResult> CreateCounterpartyEndpoint(
        CreateCounterparty useCase, CounterpartyRequest body, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(
            body.Name, body.Category, body.ParentCategory, body.VatNumber, body.Phone, body.Email, ct);
        return result switch
        {
            CreateCounterpartyResult.Refused        => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            CreateCounterpartyResult.Created created => TypedResults.Json(ToDto(created.Counterparty), statusCode: StatusCodes.Status201Created),
            CreateCounterpartyResult.Failed         => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                                       => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    public static async Task<IResult> GetCounterpartyEndpoint(
        GetCounterparty useCase, Guid id, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(id, ct);
        return result switch
        {
            GetCounterpartyResult.Refused  => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            GetCounterpartyResult.Ok ok    => TypedResults.Ok(ToDto(ok.Counterparty)),
            GetCounterpartyResult.NotFound => TypedResults.NotFound(),
            GetCounterpartyResult.Failed   => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                              => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    public static async Task<IResult> UpdateCounterpartyEndpoint(
        UpdateCounterparty useCase, Guid id, CounterpartyRequest body, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(
            id, body.Name, body.Category, body.ParentCategory, body.VatNumber, body.Phone, body.Email, ct);
        return result switch
        {
            UpdateCounterpartyResult.Refused  => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            UpdateCounterpartyResult.Ok ok    => TypedResults.Ok(ToDto(ok.Counterparty)),
            UpdateCounterpartyResult.NotFound => TypedResults.NotFound(),
            UpdateCounterpartyResult.Failed   => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                                 => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    public static async Task<IResult> DeleteCounterpartyEndpoint(
        DeleteCounterparty useCase, Guid id, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(id, ct);
        return result switch
        {
            DeleteCounterpartyResult.Refused  => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            DeleteCounterpartyResult.Ok       => TypedResults.NoContent(),
            DeleteCounterpartyResult.HasBills => TypedResults.StatusCode(StatusCodes.Status409Conflict),
            DeleteCounterpartyResult.NotFound => TypedResults.NotFound(),
            DeleteCounterpartyResult.Failed   => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                                 => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    private static CounterpartyDto ToDto(Counterparty c) => new(
        c.Id, c.Name, c.Category, c.ParentCategory, c.VatNumber, c.Phone, c.Email, c.CreatedAt, c.UpdatedAt);
}
