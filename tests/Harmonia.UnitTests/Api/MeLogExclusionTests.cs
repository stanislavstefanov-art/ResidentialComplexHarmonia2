using Microsoft.Extensions.Logging;
using Harmonia.Api.Me;
using Harmonia.Application;
using Harmonia.Application.PendingSignIn;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Api;

// R3: OID (EntraObjectId) is personal data — it must never appear in log output
// from GET /me regardless of the caller's activation status.
public class MeLogExclusionTests
{
    private const string SecretOid = "oid-pii-secret-99";

    private static GetCallerStatus UseCase(SessionContext ctx)
        => new(new FakeSession(ctx));

    [Theory]
    [InlineData(true,  false, false)] // pending caller
    [InlineData(false, true,  false)] // resident caller
    [InlineData(false, false, true)]  // admin caller
    public async Task GetMe_never_logs_EntraObjectId(
        bool isPending, bool isResident, bool isAdmin)
    {
        var ctx = new SessionContext(
            IsResident: isResident, IsAdmin: isAdmin,
            HouseholdRef: isResident ? new HouseholdRef("HH-1") : null,
            EntraObjectId: SecretOid, IsPending: isPending);
        var logger = new CapturingLogger();

        await MeEndpoints.GetMe(UseCase(ctx), logger, default);

        Assert.NotEmpty(logger.Lines);
        Assert.All(logger.Lines, line => Assert.DoesNotContain(SecretOid, line));
    }
}
