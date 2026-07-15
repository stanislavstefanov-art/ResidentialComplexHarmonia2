using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.UnitTests.Application;

public class GetDirectoryTests
{
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-GD-1"));
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var useCase = new GetDirectory(new FakeSession(null), new FakeDirectoryStore());
        Assert.IsType<GetDirectoryResult.Refused>(await useCase.ExecuteAsync());
    }

    [Fact]
    public async Task Resident_session_returns_ResidentView()
    {
        var useCase = new GetDirectory(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        Assert.IsType<GetDirectoryResult.ResidentView>(await useCase.ExecuteAsync());
    }

    [Fact]
    public async Task Admin_session_returns_BoardView()
    {
        var useCase = new GetDirectory(new FakeSession(AdminCtx), new FakeDirectoryStore());
        Assert.IsType<GetDirectoryResult.BoardView>(await useCase.ExecuteAsync());
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var useCase = new GetDirectory(new FakeSession(ResidentCtx), new FailingDirectoryStore());
        Assert.IsType<GetDirectoryResult.Failed>(await useCase.ExecuteAsync());
    }

    [Fact]
    public async Task Admin_with_HouseholdRef_still_returns_BoardView()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: new HouseholdRef("HH-ADM-1"));
        var useCase = new GetDirectory(new FakeSession(ctx), new FakeDirectoryStore());
        Assert.IsType<GetDirectoryResult.BoardView>(await useCase.ExecuteAsync());
    }

    [Fact]
    public async Task No_role_session_returns_Refused()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: false, HouseholdRef: null);
        var useCase = new GetDirectory(new FakeSession(ctx), new FakeDirectoryStore());
        Assert.IsType<GetDirectoryResult.Refused>(await useCase.ExecuteAsync());
    }

    [Fact]
    public async Task Admin_wins_over_resident_returns_BoardView()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: true, HouseholdRef: new HouseholdRef("HH-BOTH-1"));
        var useCase = new GetDirectory(new FakeSession(ctx), new FakeDirectoryStore());
        Assert.IsType<GetDirectoryResult.BoardView>(await useCase.ExecuteAsync());
    }

    [Fact]
    public async Task OptedOut_household_is_hidden_in_ResidentView()
    {
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-OPT-1"), "Alice", null, null, null,
            IsOptedOut: true, DateTimeOffset.UtcNow));
        var useCase = new GetDirectory(new FakeSession(ResidentCtx), store);
        var result = Assert.IsType<GetDirectoryResult.ResidentView>(await useCase.ExecuteAsync());
        Assert.Empty(result.Entries);
    }
}
