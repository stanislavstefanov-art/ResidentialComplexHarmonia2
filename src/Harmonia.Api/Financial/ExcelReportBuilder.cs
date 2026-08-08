using ClosedXML.Excel;
using Harmonia.Application.Financial;

namespace Harmonia.Api.Financial;

public static class ExcelReportBuilder
{
    private static readonly XLColor Green      = XLColor.FromHtml("#2e6b4f");
    private static readonly XLColor LightGreen = XLColor.FromHtml("#e8f0ec");
    private static readonly XLColor LightGray  = XLColor.FromHtml("#f0f4f1");
    private static readonly XLColor Red        = XLColor.FromHtml("#cc0000");
    private const string NumFmt = "#,##0.00";
    private const int Cols = 14; // label + 12 months + total

    public static byte[] Build(AnnualReportData data)
    {
        using var wb = new XLWorkbook();
        var ws = wb.AddWorksheet($"Report {data.Year}");

        int row = 1;

        // Title
        ws.Cell(row, 1).Value = $"Annual Financial Report — {data.Year}";
        ws.Cell(row, 1).Style.Font.Bold = true;
        ws.Cell(row, 1).Style.Font.FontSize = 14;
        ws.Range(row, 1, row, Cols).Merge();
        row += 2;

        // Column headers
        ws.Cell(row, 1).Value = "Category";
        for (int m = 0; m < 12; m++)
            ws.Cell(row, m + 2).Value = data.Months[m];
        ws.Cell(row, 14).Value = "Total";
        StyleHeader(ws.Range(row, 1, row, Cols));
        row++;

        // ── Income ──
        WriteSectionLabel(ws, ref row, "INCOME");
        WriteMonthlyLine(ws, ref row, data.MaintenanceFees.Category, data.MaintenanceFees.ByMonth, data.MaintenanceFees.Total);
        foreach (var line in data.OtherIncome)
            WriteMonthlyLine(ws, ref row, $"  {line.Category}", line.ByMonth, line.Total);
        row++;

        // ── Expenses ──
        WriteSectionLabel(ws, ref row, "EXPENSES");
        foreach (var parent in data.Expenses)
            foreach (var sub in parent.SubCategories)
                WriteMonthlyLine(ws, ref row, $"  {parent.ParentCategory} / {sub.Name}", sub.ByMonth, sub.Total);
        row++;

        // ── Period result ──
        ws.Cell(row, 1).Value = "Period Result";
        ws.Cell(row, 1).Style.Font.Bold = true;
        for (int m = 0; m < 12; m++)
            WriteNumCell(ws.Cell(row, m + 2), data.PeriodResultByMonth[m], bold: true);
        WriteNumCell(ws.Cell(row, 14), data.PeriodResultTotal, bold: true);
        var resultRange = ws.Range(row, 1, row, Cols);
        resultRange.Style.Fill.BackgroundColor = LightGreen;
        resultRange.Style.Border.TopBorder = XLBorderStyleValues.Medium;
        resultRange.Style.Border.TopBorderColor = Green;

        ws.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    private static void StyleHeader(IXLRange range)
    {
        range.Style.Font.Bold = true;
        range.Style.Fill.BackgroundColor = Green;
        range.Style.Font.FontColor = XLColor.White;
        range.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
    }

    private static void WriteSectionLabel(IXLWorksheet ws, ref int row, string label)
    {
        var range = ws.Range(row, 1, row, Cols);
        range.Merge();
        range.FirstCell().Value = label;
        range.Style.Font.Bold = true;
        range.Style.Fill.BackgroundColor = LightGray;
        row++;
    }

    private static void WriteMonthlyLine(IXLWorksheet ws, ref int row, string label, decimal[] byMonth, decimal total)
    {
        ws.Cell(row, 1).Value = label;
        for (int m = 0; m < 12; m++)
            WriteNumCell(ws.Cell(row, m + 2), byMonth[m]);
        WriteNumCell(ws.Cell(row, 14), total, bold: true);
        row++;
    }

    private static void WriteNumCell(IXLCell cell, decimal value, bool bold = false)
    {
        cell.Value = value;
        cell.Style.NumberFormat.Format = NumFmt;
        if (bold) cell.Style.Font.Bold = true;
        if (value < 0) cell.Style.Font.FontColor = Red;
    }
}
