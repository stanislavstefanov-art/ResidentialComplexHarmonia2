namespace Harmonia.Application.Financial;

/// <summary>
/// What an invoice scan actually managed to extract. Every value is optional — null means
/// "the model did not find this", never a zero/blank stand-in, so callers can tell a missing
/// field apart from a genuine empty one.
/// </summary>
/// <param name="Confidence">
/// The LOWEST per-field confidence across the fields that were extracted (weakest link), or
/// null when nothing was extracted at all. This is deliberately not the document-type
/// classification score — see <c>AzureInvoiceScanner</c> for why that number is meaningless here.
/// </param>
public record ScannedInvoice(decimal? Amount, DateOnly? Date, string? Vendor, float? Confidence)
{
    /// <summary>True when the scan produced at least one usable field.</summary>
    public bool HasAnyField => Amount is not null || Date is not null || Vendor is not null;
}

public interface IInvoiceScanner
{
    Task<ScannedInvoice> ScanAsync(Stream fileStream, string contentType, CancellationToken ct);
}
