using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging.Abstractions;
using Harmonia.Api.MaintenanceFees;
using Harmonia.Application;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;

namespace Harmonia.UnitTests.Api;

public class MaintenanceFeeEndpointsTests
{
    private static readonly HouseholdRef Target = new("HH-ENDPOINT-TEST");

    private static SessionContext AdminCtx =>
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    private static SessionContext ResidentCtx =>
        new(IsResident: true, IsAdmin: false, HouseholdRef: Target);

    private static RecordChargeRequest DefaultRequest =>
        new(100m, "Monthly fee", "2026-07", "idem-test");

    private static MaintenanceFeeCharge MakeCharge() =>
        new(Guid.NewGuid(), Target, 100m, "Monthly fee", "2026-07",
            DateTimeOffset.UtcNow, "idem-test");

    [Fact] // Non-admin POST → 403
    public async Task Post_non_admin_returns_403()
    {
        var store = new FakeMaintenanceFeeStore();
        var useCase = new RecordCharge(new FakeSession(ResidentCtx), store);

        var result = await MaintenanceFeeEndpoints.RecordChargeEndpoint(
            useCase, Target.Value, DefaultRequest, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact] // Admin POST new charge → 201 with charge DTO
    public async Task Post_admin_new_charge_returns_201()
    {
        var store = new FakeMaintenanceFeeStore();
        var useCase = new RecordCharge(new FakeSession(AdminCtx), store);

        var result = await MaintenanceFeeEndpoints.RecordChargeEndpoint(
            useCase, Target.Value, DefaultRequest, NullLogger.Instance, default);

        var json = Assert.IsType<JsonHttpResult<ChargeDto>>(result);
        Assert.Equal(StatusCodes.Status201Created, json.StatusCode);
        Assert.Equal(Target.Value, json.Value!.HouseholdRef);
        Assert.Equal(100m, json.Value.AmountEur);
    }

    [Fact] // Admin POST duplicate → 200 with existing charge DTO
    public async Task Post_admin_duplicate_returns_200()
    {
        var store = new FakeMaintenanceFeeStore();
        await store.RecordChargeAsync(MakeCharge(), default);
        var useCase = new RecordCharge(new FakeSession(AdminCtx), store);

        var result = await MaintenanceFeeEndpoints.RecordChargeEndpoint(
            useCase, Target.Value, DefaultRequest, NullLogger.Instance, default);

        var json = Assert.IsType<JsonHttpResult<ChargeDto>>(result);
        Assert.Equal(StatusCodes.Status200OK, json.StatusCode);
    }

    [Fact] // No session GET → 403
    public async Task Get_no_session_returns_403()
    {
        var useCase = new ListCharges(new FakeSession(null), new FakeMaintenanceFeeStore());

        var result = await MaintenanceFeeEndpoints.ListChargesEndpoint(
            useCase, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact] // Resident GET own charges → 200
    public async Task Get_resident_own_charges_returns_200()
    {
        var store = new FakeMaintenanceFeeStore();
        await store.RecordChargeAsync(MakeCharge(), default);
        var useCase = new ListCharges(new FakeSession(ResidentCtx), store);

        var result = await MaintenanceFeeEndpoints.ListChargesEndpoint(
            useCase, NullLogger.Instance, default);

        var json = Assert.IsType<JsonHttpResult<List<ChargeDto>>>(result);
        Assert.Equal(StatusCodes.Status200OK, json.StatusCode);
        Assert.Single(json.Value!);
    }

    [Fact] // Non-resident, non-admin GET → 403
    public async Task Get_non_resident_returns_403()
    {
        var nonResidentCtx = new SessionContext(IsResident: false, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-X"));
        var useCase = new ListCharges(new FakeSession(nonResidentCtx), new FakeMaintenanceFeeStore());

        var result = await MaintenanceFeeEndpoints.ListChargesEndpoint(
            useCase, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact] // Admin GET → 403 (admin list is out of scope; spec §2)
    public async Task Get_admin_returns_403()
    {
        var store = new FakeMaintenanceFeeStore();
        await store.RecordChargeAsync(MakeCharge(), default);
        var useCase = new ListCharges(new FakeSession(AdminCtx), store);

        var result = await MaintenanceFeeEndpoints.ListChargesEndpoint(
            useCase, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }
}
