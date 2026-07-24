using Microsoft.Extensions.Logging;
using Harmonia.Api.Admin;
using Harmonia.Application;
using Harmonia.Application.PendingSignIn;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Api;

// R3: OID, email, displayName, and householdRef are personal data — they must never
// appear in log output from the three admin pending endpoints.
public class AdminPendingLogExclusionTests
{
    private static SessionContext AdminSession()
        => new(IsResident: false, IsAdmin: true, HouseholdRef: null,
               EntraObjectId: "admin-test-1", IsPending: false);

    [Fact]
    public async Task ListPending_never_logs_OID_email_or_displayName()
    {
        const string secretOid         = "oid-pii-list-secret";
        const string secretEmail       = "secret-list@pii.example";
        const string secretDisplayName = "List PII Secret Name";

        var store = new FakePendingSignInStoreV2
        {
            Pending =
            [
                new PendingSignIn(secretOid, secretEmail, secretDisplayName, DateTimeOffset.UtcNow.AddDays(-1))
            ]
        };
        var useCase = new ListPendingSignIns(new FakeSession(AdminSession()), store);
        var logger  = new CapturingLogger();

        await AdminPendingEndpoints.ListPendingEndpoint(useCase, logger, default);

        Assert.NotEmpty(logger.Lines);
        Assert.All(logger.Lines, line =>
        {
            Assert.DoesNotContain(secretOid,         line);
            Assert.DoesNotContain(secretEmail,       line);
            Assert.DoesNotContain(secretDisplayName, line);
        });
    }

    [Fact]
    public async Task ActivatePending_never_logs_oid_or_householdRef()
    {
        const string secretOid          = "oid-pii-activate-secret";
        const string secretHouseholdRef = "HH-PII-SECRET-42";

        var store = new FakePendingSignInStoreV2
        {
            Pending =
            [
                new PendingSignIn(secretOid, "e@x.com", "Name", DateTimeOffset.UtcNow.AddDays(-1))
            ]
        };
        var useCase = new ActivatePendingSignIn(new FakeSession(AdminSession()), store);
        var logger  = new CapturingLogger();

        await AdminPendingEndpoints.ActivatePendingEndpoint(
            useCase, secretOid, new ActivateRequest(secretHouseholdRef), logger, default);

        Assert.NotEmpty(logger.Lines);
        Assert.All(logger.Lines, line =>
        {
            Assert.DoesNotContain(secretOid,          line);
            Assert.DoesNotContain(secretHouseholdRef, line);
        });
    }

    [Fact]
    public async Task PurgePending_logs_only_outcome_name()
    {
        var store   = new FakePendingSignInStoreV2();
        var useCase = new PurgeExpiredPendingSignIns(new FakeSession(AdminSession()), store);
        var logger  = new CapturingLogger();

        await AdminPendingEndpoints.PurgeExpiredPendingEndpoint(useCase, logger, default);

        Assert.NotEmpty(logger.Lines);
        // The logged line should contain the outcome type name
        Assert.Contains("Ok", logger.Lines[0]);
    }
}
