using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class UpdateContactTests
{
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-UC-1"));

    [Fact]
    public async Task Admin_session_returns_Ok()
    {
        var useCase = new UpdateContact(new FakeSession(AdminCtx), new FakeDirectoryStore());
        Assert.IsType<UpdateContactResult.Ok>(
            await useCase.ExecuteAsync("HH-TARGET-1", "Bob", "555-0200", null));
    }

    [Fact]
    public async Task Resident_session_returns_Refused()
    {
        var useCase = new UpdateContact(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        Assert.IsType<UpdateContactResult.Refused>(
            await useCase.ExecuteAsync("HH-OTHER-1", "Bob", null, null));
    }

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var useCase = new UpdateContact(new FakeSession(null), new FakeDirectoryStore());
        Assert.IsType<UpdateContactResult.Refused>(
            await useCase.ExecuteAsync("HH-TARGET-1", null, null, null));
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var useCase = new UpdateContact(new FakeSession(AdminCtx), new FailingDirectoryStore());
        Assert.IsType<UpdateContactResult.Failed>(
            await useCase.ExecuteAsync("HH-TARGET-1", "Bob", null, null));
    }
}
