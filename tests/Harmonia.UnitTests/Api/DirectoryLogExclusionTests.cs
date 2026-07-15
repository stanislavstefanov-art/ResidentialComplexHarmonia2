using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Harmonia.Api.Directory;
using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.UnitTests.Api;

/// <summary>
/// R3 compliance: householdRef must never appear in any log line emitted by the
/// directory erase endpoints, regardless of result outcome.
/// </summary>
public class DirectoryLogExclusionTests
{
    private const string SecretResidentRef = "HH-R3-RESIDENT-SECRET";
    private const string SecretBoardRef    = "HH-R3-BOARD-SECRET";

    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef(SecretResidentRef));
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    [Theory]
    [InlineData("ok")]
    [InlineData("not_found")]
    [InlineData("refused")]
    [InlineData("failed")]
    public async Task EraseMyContact_endpoint_never_logs_householdRef(string scenario)
    {
        var store = new FakeDirectoryStore();
        if (scenario == "ok")
        {
            store.Contacts.Add(new HouseholdContact(
                new HouseholdRef(SecretResidentRef), "Alice", null, null, null,
                IsOptedOut: false, DateTimeOffset.UtcNow));
        }

        var session = scenario == "refused"
            ? new FakeSession(null)
            : new FakeSession(ResidentCtx);
        IDirectoryStore storeToUse = scenario == "failed"
            ? new FailingDirectoryStore()
            : store;

        var logger = new CapturingLogger();
        var uc = new EraseMyContact(session, storeToUse);

        await DirectoryEndpoints.EraseMyContactEndpoint(uc, logger, default);

        Assert.All(logger.Lines, line => Assert.DoesNotContain(SecretResidentRef, line));
    }

    [Theory]
    [InlineData("ok")]
    [InlineData("not_found")]
    [InlineData("refused")]
    [InlineData("failed")]
    public async Task EraseContact_endpoint_never_logs_householdRef(string scenario)
    {
        var store = new FakeDirectoryStore();
        if (scenario == "ok")
        {
            store.Contacts.Add(new HouseholdContact(
                new HouseholdRef(SecretBoardRef), "Bob", null, null, null,
                IsOptedOut: false, DateTimeOffset.UtcNow));
        }

        var session = scenario == "refused"
            ? new FakeSession(ResidentCtx)
            : new FakeSession(AdminCtx);
        IDirectoryStore storeToUse = scenario == "failed"
            ? new FailingDirectoryStore()
            : store;

        var logger = new CapturingLogger();
        var uc = new EraseContact(session, storeToUse);

        await DirectoryEndpoints.EraseContactEndpoint(uc, SecretBoardRef, logger, default);

        Assert.All(logger.Lines, line => Assert.DoesNotContain(SecretBoardRef, line));
    }
}
