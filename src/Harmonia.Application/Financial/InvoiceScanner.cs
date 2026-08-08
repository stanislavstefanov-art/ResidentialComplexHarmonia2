namespace Harmonia.Application.Financial;

public record ScannedInvoice(decimal? Amount, DateOnly? Date, string? Vendor, float Confidence);

public interface IInvoiceScanner
{
    Task<ScannedInvoice> ScanAsync(Stream fileStream, string contentType, CancellationToken ct);
}
