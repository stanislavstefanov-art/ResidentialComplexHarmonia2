using Microsoft.AspNetCore.Http.HttpResults;
using Harmonia.Application.Expenses;
using Harmonia.Domain.Expenses;

namespace Harmonia.Api.Expenses;

public sealed record RecordExpenseRequest(
    decimal  AmountEur,
    string   Description,
    Guid     CounterpartyId,
    DateOnly ExpenseDate,
    string   IdempotencyKey);

// POST response — no join; the client already knows the counterparty it picked.
public sealed record ExpenseDto(
    Guid           Id,
    decimal        AmountEur,
    string         Description,
    Guid           CounterpartyId,
    DateOnly       ExpenseDate,
    DateTimeOffset RecordedAt,
    string         IdempotencyKey);

// GET list response — joined counterparty display fields.
public sealed record ExpenseListItemDto(
    Guid           Id,
    decimal        AmountEur,
    string         Description,
    Guid           CounterpartyId,
    string         CounterpartyName,
    string         CounterpartyCategory,
    string         CounterpartyParentCategory,
    DateOnly       ExpenseDate,
    DateTimeOffset RecordedAt,
    string         IdempotencyKey);

public static class ExpenseEndpoints
{
    public static async Task<IResult> RecordExpenseEndpoint(
        RecordExpense useCase, RecordExpenseRequest body, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(
            body.AmountEur, body.Description, body.CounterpartyId, body.ExpenseDate, body.IdempotencyKey, ct);

        switch (result)
        {
            case RecordExpenseResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case RecordExpenseResult.Created created:
                logger.LogInformation("Expense recorded: created");
                return TypedResults.Json(ToDto(created.Expense), statusCode: StatusCodes.Status201Created);
            case RecordExpenseResult.Duplicate duplicate:
                logger.LogInformation("Expense recorded: duplicate (idempotent)");
                return TypedResults.Json(ToDto(duplicate.Expense), statusCode: StatusCodes.Status200OK);
            case RecordExpenseResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public static async Task<IResult> ListExpensesEndpoint(
        ListExpenses useCase, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(ct);

        switch (result)
        {
            case ListExpensesResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case ListExpensesResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            case ListExpensesResult.Ok ok:
                logger.LogInformation("Expenses listed: {Count}", ok.Expenses.Count);
                return TypedResults.Json(
                    ok.Expenses.Select(ToListDto).ToList(),
                    statusCode: StatusCodes.Status200OK);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    private static ExpenseDto ToDto(AssociationExpense e) =>
        new(e.Id, e.AmountEur, e.Description, e.CounterpartyId, e.ExpenseDate, e.RecordedAt, e.IdempotencyKey);

    private static ExpenseListItemDto ToListDto(ExpenseListItem e) =>
        new(e.Id, e.AmountEur, e.Description, e.CounterpartyId, e.CounterpartyName,
            e.CounterpartyCategory, e.CounterpartyParentCategory, e.ExpenseDate, e.RecordedAt, e.IdempotencyKey);
}
