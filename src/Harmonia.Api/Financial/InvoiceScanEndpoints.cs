using Harmonia.Application.Financial;
using ISession = Harmonia.Application.ISession;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Harmonia.Api.Financial;

public sealed record InvoiceScanDto(decimal? Amount, string? Date, string? Vendor, float? Confidence);

public static class InvoiceScanEndpoints
{
    public static async Task<IResult> ScanEndpoint(
        ISession session, IInvoiceScanner scanner, IFormFile file,
        ILogger logger, CancellationToken ct)
    {
        var caller = session.Resolve();
        if (caller is null || !caller.IsAdmin)
        {
            logger.LogInformation("Invoice scan refused: caller is not an admin");
            return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
        }

        if (file.Length == 0)
        {
            logger.LogInformation("Invoice scan rejected: empty file");
            return Results.BadRequest("File is empty.");
        }

        await using var stream = file.OpenReadStream();
        var result = await scanner.ScanAsync(stream, file.ContentType, ct);

        // R3: log which fields were found and how confident the model was — never the
        // extracted values, the vendor name, or the uploaded file name. The document is
        // someone's paperwork; only the shape of the outcome is safe to record.
        logger.LogInformation(
            "Invoice scan completed: contentType={ContentType} bytes={Bytes} " +
            "amountFound={AmountFound} dateFound={DateFound} vendorFound={VendorFound} confidence={Confidence}",
            file.ContentType, file.Length,
            result.Amount is not null, result.Date is not null, result.Vendor is not null,
            result.Confidence);

        if (!result.HasAnyField)
            logger.LogWarning("Invoice scan found no invoice fields: the document was analysed but nothing matched");

        return Results.Ok(new InvoiceScanDto(
            result.Amount,
            result.Date?.ToString("yyyy-MM-dd"),
            result.Vendor,
            result.Confidence));
    }
}
