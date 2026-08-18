using Azure;
using Azure.AI.FormRecognizer.DocumentAnalysis;
using Harmonia.Application.Financial;

namespace Harmonia.Api.Financial;

public sealed class AzureInvoiceScanner(string endpoint, string key) : IInvoiceScanner
{
    private static readonly ScannedInvoice NothingFound = new(null, null, null, null);

    private readonly DocumentAnalysisClient _client =
        new(new Uri(endpoint), new AzureKeyCredential(key));

    public async Task<ScannedInvoice> ScanAsync(Stream fileStream, string contentType, CancellationToken ct)
    {
        var op = await _client.AnalyzeDocumentAsync(
            WaitUntil.Completed, "prebuilt-invoice", fileStream, cancellationToken: ct);

        var result = op.Value;
        if (result.Documents.Count == 0)
            return NothingFound;

        var doc = result.Documents[0];

        // NOT doc.Confidence. That is the document-TYPE classification score, and
        // prebuilt-invoice knows exactly one type ("invoice") — so it returns 1.0 for any
        // document it can parse at all, including a shopping list. Reporting it made a
        // scan that extracted nothing read as "Confidence: 100%". Only the per-field
        // confidences say anything about whether the extraction is trustworthy.
        var confidences = new List<float>(3);

        decimal? amount = null;
        DateOnly? date = null;
        string? vendor = null;

        if (doc.Fields.TryGetValue("InvoiceTotal", out var totalField) &&
            totalField.FieldType == DocumentFieldType.Currency)
        {
            amount = (decimal)totalField.Value.AsCurrency().Amount;
            confidences.Add(totalField.Confidence ?? 0f);
        }

        if (doc.Fields.TryGetValue("InvoiceDate", out var dateField) &&
            dateField.FieldType == DocumentFieldType.Date)
        {
            date = DateOnly.FromDateTime(dateField.Value.AsDate().DateTime);
            confidences.Add(dateField.Confidence ?? 0f);
        }

        if (doc.Fields.TryGetValue("VendorName", out var vendorField) &&
            vendorField.FieldType == DocumentFieldType.String)
        {
            // A blank vendor is not a usable field — treat it as not found rather than
            // letting it overwrite the description with an empty string.
            var name = vendorField.Value.AsString();
            if (!string.IsNullOrWhiteSpace(name))
            {
                vendor = name;
                confidences.Add(vendorField.Confidence ?? 0f);
            }
        }

        return confidences.Count == 0
            ? NothingFound
            : new ScannedInvoice(amount, date, vendor, confidences.Min());
    }
}
