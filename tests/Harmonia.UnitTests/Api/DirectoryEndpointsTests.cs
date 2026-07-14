using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging.Abstractions;
using Harmonia.Api.Directory;
using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.UnitTests.Api;

public class DirectoryEndpointsTests
{
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-EP-1"));
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    // ── GET /directory ─────────────────────────────────────────────────────

    [Fact]
    public async Task GetDirectory_resident_returns_200()
    {
        var uc = new GetDirectory(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.GetDirectoryEndpoint(uc, NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status200OK,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task GetDirectory_board_returns_200()
    {
        var uc = new GetDirectory(new FakeSession(AdminCtx), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.GetDirectoryEndpoint(uc, NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status200OK,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task GetDirectory_refused_returns_403()
    {
        var uc = new GetDirectory(new FakeSession(null), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.GetDirectoryEndpoint(uc, NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status403Forbidden,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task GetDirectory_store_failure_returns_500()
    {
        var uc = new GetDirectory(new FakeSession(ResidentCtx), new FailingDirectoryStore());
        var result = await DirectoryEndpoints.GetDirectoryEndpoint(uc, NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status500InternalServerError,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    // ── PUT /directory/contact ─────────────────────────────────────────────

    [Fact]
    public async Task UpdateMyContact_ok_returns_200()
    {
        var uc = new UpdateMyContact(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.UpdateMyContactEndpoint(
            uc, new UpdateContactRequest("Alice", null, null), NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status200OK,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task UpdateMyContact_refused_returns_403()
    {
        var uc = new UpdateMyContact(new FakeSession(null), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.UpdateMyContactEndpoint(
            uc, new UpdateContactRequest(null, null, null), NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status403Forbidden,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task UpdateMyContact_store_failure_returns_500()
    {
        var uc = new UpdateMyContact(new FakeSession(ResidentCtx), new FailingDirectoryStore());
        var result = await DirectoryEndpoints.UpdateMyContactEndpoint(
            uc, new UpdateContactRequest("Alice", null, null), NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status500InternalServerError,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    // ── PUT /directory/{householdRef}/contact ──────────────────────────────

    [Fact]
    public async Task UpdateContact_ok_returns_200()
    {
        var uc = new UpdateContact(new FakeSession(AdminCtx), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.UpdateContactEndpoint(
            uc, "HH-TARGET-1", new UpdateContactRequest("Bob", null, null),
            NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status200OK,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task UpdateContact_refused_returns_403()
    {
        var uc = new UpdateContact(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.UpdateContactEndpoint(
            uc, "HH-OTHER-1", new UpdateContactRequest(null, null, null),
            NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status403Forbidden,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task UpdateContact_store_failure_returns_500()
    {
        var uc = new UpdateContact(new FakeSession(AdminCtx), new FailingDirectoryStore());
        var result = await DirectoryEndpoints.UpdateContactEndpoint(
            uc, "HH-TARGET-1", new UpdateContactRequest("Bob", null, null),
            NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status500InternalServerError,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    // ── PUT /directory/{householdRef}/notes ───────────────────────────────

    [Fact]
    public async Task UpdateNotes_ok_returns_200()
    {
        var uc = new UpdateNotes(new FakeSession(AdminCtx), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.UpdateNotesEndpoint(
            uc, "HH-TARGET-1", new UpdateNotesRequest("Parking A12"),
            NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status200OK,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task UpdateNotes_refused_returns_403()
    {
        var uc = new UpdateNotes(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.UpdateNotesEndpoint(
            uc, "HH-OTHER-1", new UpdateNotesRequest("note"),
            NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status403Forbidden,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task UpdateNotes_store_failure_returns_500()
    {
        var uc = new UpdateNotes(new FakeSession(AdminCtx), new FailingDirectoryStore());
        var result = await DirectoryEndpoints.UpdateNotesEndpoint(
            uc, "HH-TARGET-1", new UpdateNotesRequest("note"),
            NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status500InternalServerError,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task GetDirectory_resident_view_omits_PII_fields()
    {
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-EP-PII"), "Alice", "555-9999", "alice@test.com", "secret",
            DateTimeOffset.UtcNow));
        var uc = new GetDirectory(new FakeSession(ResidentCtx), store);
        var result = await DirectoryEndpoints.GetDirectoryEndpoint(uc, NullLogger.Instance, default);

        var json = Assert.IsType<JsonHttpResult<List<DirectoryEntryPublicDto>>>(result);
        Assert.NotNull(json.Value);
        Assert.Single(json.Value);
        Assert.Equal("Alice", json.Value[0].DisplayName);
    }
}
