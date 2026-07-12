using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging.Abstractions;
using Harmonia.Api.MaintenanceFees;
using Harmonia.Application;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;

namespace Harmonia.UnitTests.Api;

public class AdminChargesDashboardEndpointTests
{
    private static SessionContext AdminCtx =>
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    private static SessionContext ResidentCtx =>
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-A"));

    private static MaintenanceFeeCharge MakeCharge(string householdRef, string key) =>
        new(Guid.NewGuid(), new HouseholdRef(householdRef), 100m, "Fee", "2026-07",
            DateTimeOffset.UtcNow, key);

    [Fact]
    public async Task Admin_gets_all_charges_200()
    {
        var store = new FakeMaintenanceFeeStore();
        await store.RecordChargeAsync(MakeCharge("HH-A", "k1"), default);
        await store.RecordChargeAsync(MakeCharge("HH-B", "k2"), default);
        var useCase = new ListAllCharges(new FakeSession(AdminCtx), store);

        var result = await MaintenanceFeeEndpoints.ListAllChargesEndpoint(
            useCase, NullLogger.Instance, default);

        var json = Assert.IsType<JsonHttpResult<List<ChargeDto>>>(result);
        Assert.Equal(StatusCodes.Status200OK, json.StatusCode);
        Assert.Equal(2, json.Value!.Count);
    }

    [Fact]
    public async Task No_session_returns_403()
    {
        var useCase = new ListAllCharges(new FakeSession(null), new FakeMaintenanceFeeStore());

        var result = await MaintenanceFeeEndpoints.ListAllChargesEndpoint(
            useCase, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact]
    public async Task Resident_returns_403()
    {
        var useCase = new ListAllCharges(new FakeSession(ResidentCtx), new FakeMaintenanceFeeStore());

        var result = await MaintenanceFeeEndpoints.ListAllChargesEndpoint(
            useCase, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact]
    public async Task Get_all_does_not_log_household_ref()
    {
        const string SecretRef = "HH-SECRET-ALL-99";
        var logger = new CapturingLogger();
        var store = new FakeMaintenanceFeeStore();
        await store.RecordChargeAsync(
            new MaintenanceFeeCharge(Guid.NewGuid(), new HouseholdRef(SecretRef),
                100m, "Fee", "2026-07", DateTimeOffset.UtcNow, $"idem-{Guid.NewGuid():N}"),
            default);
        var useCase = new ListAllCharges(new FakeSession(AdminCtx), store);

        await MaintenanceFeeEndpoints.ListAllChargesEndpoint(useCase, logger, default);

        Assert.NotEmpty(logger.Lines);
        Assert.All(logger.Lines, line => Assert.DoesNotContain(SecretRef, line));
    }
}
