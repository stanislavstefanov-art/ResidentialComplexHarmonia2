using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging.Abstractions;
using Harmonia.Api.Financial;
using Harmonia.Application;
using Harmonia.Application.Financial;

namespace Harmonia.UnitTests.Api;

public class InvoiceScanEndpointsTests
{
    private const string VendorName = "Sofia Water Utility AD";

    private static SessionContext AdminCtx =>
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    private static SessionContext ResidentCtx =>
        new(IsResident: true, IsAdmin: false, HouseholdRef: null);

    private static IFormFile File(string content = "pdf-bytes", string contentType = "application/pdf")
    {
        var bytes = Encoding.UTF8.GetBytes(content);
        return new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", "invoice.pdf")
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType,
        };
    }

    private static ScannedInvoice FullScan =>
        new(142.50m, new DateOnly(2026, 3, 31), VendorName, 0.87f);

    [Fact]
    public async Task Non_admin_returns_403_and_never_calls_the_scanner()
    {
        var scanner = new FakeInvoiceScanner(FullScan);

        var result = await InvoiceScanEndpoints.ScanEndpoint(
            new FakeSession(ResidentCtx), scanner, File(), NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
        Assert.False(scanner.WasCalled);
    }

    [Fact]
    public async Task No_session_returns_403()
    {
        var result = await InvoiceScanEndpoints.ScanEndpoint(
            new FakeSession(null), new FakeInvoiceScanner(FullScan), File(), NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact]
    public async Task Empty_file_returns_400()
    {
        var result = await InvoiceScanEndpoints.ScanEndpoint(
            new FakeSession(AdminCtx), new FakeInvoiceScanner(FullScan), File(""), NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status400BadRequest, status.StatusCode);
    }

    [Fact]
    public async Task Extracted_fields_flow_through_with_their_confidence()
    {
        var result = await InvoiceScanEndpoints.ScanEndpoint(
            new FakeSession(AdminCtx), new FakeInvoiceScanner(FullScan), File(), NullLogger.Instance, default);

        var ok = Assert.IsType<Ok<InvoiceScanDto>>(result);
        Assert.Equal(142.50m, ok.Value!.Amount);
        Assert.Equal("2026-03-31", ok.Value.Date);
        Assert.Equal(VendorName, ok.Value.Vendor);
        Assert.Equal(0.87f, ok.Value.Confidence);
    }

    // The bug this replaced: prebuilt-invoice classifies ANY parseable document as an
    // "invoice" with document-type confidence 1.0, so a scan that extracted nothing still
    // reported "Confidence: 100%". A no-fields scan must now report a null confidence.
    [Fact]
    public async Task Scan_with_no_matched_fields_reports_null_confidence()
    {
        var result = await InvoiceScanEndpoints.ScanEndpoint(
            new FakeSession(AdminCtx), FakeInvoiceScanner.FindingNothing(), File(), NullLogger.Instance, default);

        var ok = Assert.IsType<Ok<InvoiceScanDto>>(result);
        Assert.Null(ok.Value!.Amount);
        Assert.Null(ok.Value.Date);
        Assert.Null(ok.Value.Vendor);
        Assert.Null(ok.Value.Confidence);
    }

    [Fact]
    public async Task Scan_outcome_is_logged()
    {
        var logger = new CapturingLogger();

        await InvoiceScanEndpoints.ScanEndpoint(
            new FakeSession(AdminCtx), new FakeInvoiceScanner(FullScan), File(), logger, default);

        var line = Assert.Single(logger.Lines, l => l.Contains("Invoice scan completed"));
        Assert.Contains("amountFound=True", line);
        Assert.Contains("dateFound=True", line);
        Assert.Contains("vendorFound=True", line);
    }

    [Fact]
    public async Task A_scan_that_finds_nothing_is_logged_as_such()
    {
        var logger = new CapturingLogger();

        await InvoiceScanEndpoints.ScanEndpoint(
            new FakeSession(AdminCtx), FakeInvoiceScanner.FindingNothing(), File(), logger, default);

        Assert.Contains(logger.Lines, l => l.Contains("no invoice fields"));
        Assert.Contains(logger.Lines, l => l.Contains("amountFound=False") && l.Contains("vendorFound=False"));
    }

    // R3: the uploaded document is someone's paperwork. Log the shape of the outcome,
    // never the extracted content or the file name.
    [Fact]
    public async Task Scan_does_not_log_extracted_content_or_file_name()
    {
        var logger = new CapturingLogger();

        await InvoiceScanEndpoints.ScanEndpoint(
            new FakeSession(AdminCtx), new FakeInvoiceScanner(FullScan), File(), logger, default);

        Assert.All(logger.Lines, line =>
        {
            Assert.DoesNotContain(VendorName, line);
            Assert.DoesNotContain("142.5", line);
            Assert.DoesNotContain("invoice.pdf", line);
        });
    }

    [Fact]
    public async Task Refusal_is_logged_without_leaking_that_a_document_was_read()
    {
        var logger = new CapturingLogger();

        await InvoiceScanEndpoints.ScanEndpoint(
            new FakeSession(ResidentCtx), new FakeInvoiceScanner(FullScan), File(), logger, default);

        Assert.Contains(logger.Lines, l => l.Contains("Invoice scan refused"));
        Assert.DoesNotContain(logger.Lines, l => l.Contains("Invoice scan completed"));
    }
}
