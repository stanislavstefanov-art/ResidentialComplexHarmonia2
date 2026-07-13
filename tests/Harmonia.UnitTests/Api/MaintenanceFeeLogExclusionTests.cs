using Microsoft.Extensions.Logging;
using Harmonia.Api.MaintenanceFees;
using Harmonia.Application;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Application.Notifications;
using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;

namespace Harmonia.UnitTests.Api;

// R3: HouseholdRef is personal data — must never appear in log lines.
public class MaintenanceFeeLogExclusionTests
{
    private const string SecretRef = "HH-SECRET-FEE-99";
    private static readonly HouseholdRef Target = new(SecretRef);

    private static SessionContext AdminCtx =>
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    private static SessionContext ResidentCtx =>
        new(IsResident: true, IsAdmin: false, HouseholdRef: Target);

    private static RecordChargeRequest Request =>
        new(100m, "Fee", "2026-07", $"idem-{Guid.NewGuid():N}");

    private static MaintenanceFeeCharge MakeCharge(string key) =>
        new(Guid.NewGuid(), Target, 100m, "Fee", "2026-07", DateTimeOffset.UtcNow, key);

    [Fact] // POST new charge: outcome logged, householdRef never appears
    public async Task Post_new_charge_does_not_log_household_ref()
    {
        var logger = new CapturingLogger();
        var store = new FakeMaintenanceFeeStore();
        var useCase = new RecordCharge(new FakeSession(AdminCtx), store, new FakeNotificationDispatcher());

        await MaintenanceFeeEndpoints.RecordChargeEndpoint(
            useCase, Target.Value, Request, logger, default);

        Assert.All(logger.Lines, line => Assert.DoesNotContain(SecretRef, line));
    }

    [Fact] // POST duplicate: outcome logged, householdRef never appears
    public async Task Post_duplicate_does_not_log_household_ref()
    {
        var logger = new CapturingLogger();
        var store = new FakeMaintenanceFeeStore();
        var key = $"idem-{Guid.NewGuid():N}";
        await store.RecordChargeAsync(MakeCharge(key), default);
        var useCase = new RecordCharge(new FakeSession(AdminCtx), store, new FakeNotificationDispatcher());
        var dupRequest = new RecordChargeRequest(100m, "Fee", "2026-07", key);

        await MaintenanceFeeEndpoints.RecordChargeEndpoint(
            useCase, Target.Value, dupRequest, logger, default);

        Assert.All(logger.Lines, line => Assert.DoesNotContain(SecretRef, line));
    }

    [Fact] // GET charges: outcome logged, householdRef never appears
    public async Task Get_charges_does_not_log_household_ref()
    {
        var logger = new CapturingLogger();
        var store = new FakeMaintenanceFeeStore();
        await store.RecordChargeAsync(MakeCharge($"idem-{Guid.NewGuid():N}"), default);
        var useCase = new ListCharges(new FakeSession(ResidentCtx), store);

        await MaintenanceFeeEndpoints.ListChargesEndpoint(
            useCase, logger, default);

        Assert.All(logger.Lines, line => Assert.DoesNotContain(SecretRef, line));
    }
}
