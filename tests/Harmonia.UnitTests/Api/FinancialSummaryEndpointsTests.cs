using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Harmonia.Api.FinancialSummary;
using Harmonia.Application;
using Harmonia.Application.FinancialSummary;

namespace Harmonia.UnitTests.Api;

public class FinancialSummaryEndpointsTests
{
    private static GetFinancialSummary UseCase(SessionContext? ctx) =>
        new(new FakeSession(ctx), new FakeMaintenanceFeeStore(), new FakeExpenseStore());

    [Fact]
    public async Task Resident_gets_200()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);

        var result = await FinancialSummaryEndpoints.GetSummaryEndpoint(
            UseCase(ctx), "2026-07", NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status200OK, status.StatusCode);
    }

    [Fact]
    public async Task No_session_returns_403()
    {
        var result = await FinancialSummaryEndpoints.GetSummaryEndpoint(
            UseCase(null), "2026-07", NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact]
    public async Task Invalid_period_returns_400()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);

        var result = await FinancialSummaryEndpoints.GetSummaryEndpoint(
            UseCase(ctx), "bad-period", NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status400BadRequest, status.StatusCode);
    }

    [Fact]
    public async Task Store_failure_returns_500()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
        var useCase = new GetFinancialSummary(
            new FakeSession(ctx), new FailingMaintenanceFeeStore(), new FakeExpenseStore());

        var result = await FinancialSummaryEndpoints.GetSummaryEndpoint(
            useCase, "2026-07", NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status500InternalServerError, status.StatusCode);
    }
}
