using Harmonia.Application.Financial;
using ISession = Harmonia.Application.ISession;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Harmonia.Api.Financial;

public sealed record InvoiceScanDto(decimal? Amount, string? Date, string? Vendor, float Confidence);

public static class InvoiceScanEndpoints
{
    public static async Task<IResult> ScanEndpoint(
        ISession session, IInvoiceScanner scanner, IFormFile file,
        ILogger logger, CancellationToken ct)
    {
        var caller = session.Resolve();
        if (caller is null || !caller.IsAdmin)
            return TypedResults.StatusCode(StatusCodes.Status403Forbidden);

        if (file.Length == 0)
            return Results.BadRequest("File is empty.");

        await using var stream = file.OpenReadStream();
        var result = await scanner.ScanAsync(stream, file.ContentType, ct);

        return Results.Ok(new InvoiceScanDto(
            result.Amount,
            result.Date?.ToString("yyyy-MM-dd"),
            result.Vendor,
            result.Confidence));
    }
}
