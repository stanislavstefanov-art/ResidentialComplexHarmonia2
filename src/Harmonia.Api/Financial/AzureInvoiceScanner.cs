using Azure;
using Azure.AI.FormRecognizer.DocumentAnalysis;
using Harmonia.Application.Financial;

namespace Harmonia.Api.Financial;

public sealed class AzureInvoiceScanner(string endpoint, string key) : IInvoiceScanner
{
    private readonly DocumentAnalysisClient _client =
        new(new Uri(endpoint), new AzureKeyCredential(key));

    public async Task<ScannedInvoice> ScanAsync(Stream fileStream, string contentType, CancellationToken ct)
    {
        var op = await _client.AnalyzeDocumentAsync(
            WaitUntil.Completed, "prebuilt-invoice", fileStream, cancellationToken: ct);

        var result = op.Value;
        if (result.Documents.Count == 0)
            return new ScannedInvoice(null, null, null, 0);

        var doc = result.Documents[0];
        decimal? amount = null;
        DateOnly? date = null;
        string? vendor = null;

        if (doc.Fields.TryGetValue("InvoiceTotal", out var totalField) &&
            totalField.FieldType == DocumentFieldType.Currency)
            amount = (decimal)totalField.Value.AsCurrency().Amount;

        if (doc.Fields.TryGetValue("InvoiceDate", out var dateField) &&
            dateField.FieldType == DocumentFieldType.Date)
            date = DateOnly.FromDateTime(dateField.Value.AsDate().DateTime);

        if (doc.Fields.TryGetValue("VendorName", out var vendorField) &&
            vendorField.FieldType == DocumentFieldType.String)
            vendor = vendorField.Value.AsString();

        return new ScannedInvoice(amount, date, vendor, doc.Confidence);
    }
}
