using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Harmonia.Api.Payments;
using Harmonia.Application;
using Harmonia.Application.Payments;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Api;

public class PaymentEndpointsTests
{
    private static RecordPayment RecordUseCase(SessionContext? ctx) =>
        new(new FakeSession(ctx), new FakePaymentStore());

    private static ListAllPayments ListAllUseCase(SessionContext? ctx) =>
        new(new FakeSession(ctx), new FakePaymentStore());

    private static ListMyPayments ListMyUseCase(SessionContext? ctx) =>
        new(new FakeSession(ctx), new FakePaymentStore());

    private static GetBalance BalanceUseCase(SessionContext? ctx) =>
        new(new FakeSession(ctx), new FakeMaintenanceFeeStore(), new FakePaymentStore());

    [Fact]
    public async Task RecordPayment_admin_returns_201()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var body = new RecordPaymentRequest(
            "HH-1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-001");

        var result = await PaymentEndpoints.RecordPaymentEndpoint(
            RecordUseCase(ctx), body, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status201Created, status.StatusCode);
    }

    [Fact]
    public async Task RecordPayment_duplicate_returns_200()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var store = new FakePaymentStore();
        var body = new RecordPaymentRequest(
            "HH-1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-001");
        var useCase = new RecordPayment(new FakeSession(ctx), store);
        await useCase.ExecuteAsync("HH-1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-001");

        var result = await PaymentEndpoints.RecordPaymentEndpoint(
            useCase, body, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status200OK, status.StatusCode);
    }

    [Fact]
    public async Task RecordPayment_no_session_returns_403()
    {
        var body = new RecordPaymentRequest(
            "HH-1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-001");

        var result = await PaymentEndpoints.RecordPaymentEndpoint(
            RecordUseCase(null), body, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact]
    public async Task ListAllPayments_admin_returns_200()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);

        var result = await PaymentEndpoints.ListAllPaymentsEndpoint(
            ListAllUseCase(ctx), NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status200OK, status.StatusCode);
    }

    [Fact]
    public async Task ListMyPayments_resident_returns_200()
    {
        var ctx = new SessionContext(
            IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-1"));

        var result = await PaymentEndpoints.ListMyPaymentsEndpoint(
            ListMyUseCase(ctx), NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status200OK, status.StatusCode);
    }

    [Fact]
    public async Task GetBalance_valid_period_returns_200()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);

        var result = await PaymentEndpoints.GetBalanceEndpoint(
            BalanceUseCase(ctx), "2026-07", NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status200OK, status.StatusCode);
    }

    [Fact]
    public async Task GetBalance_invalid_period_returns_400()
    {
        var ctx = new SessionContext(
            IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-1"));

        var result = await PaymentEndpoints.GetBalanceEndpoint(
            BalanceUseCase(ctx), "not-a-period", NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status400BadRequest, status.StatusCode);
    }

    [Fact]
    public async Task GetBalance_no_session_returns_403()
    {
        var result = await PaymentEndpoints.GetBalanceEndpoint(
            BalanceUseCase(null), "2026-07", NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact]
    public async Task GetBalance_store_failure_returns_500()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var useCase = new GetBalance(
            new FakeSession(ctx), new FailingMaintenanceFeeStore(), new FakePaymentStore());

        var result = await PaymentEndpoints.GetBalanceEndpoint(
            useCase, "2026-07", NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status500InternalServerError, status.StatusCode);
    }
}
