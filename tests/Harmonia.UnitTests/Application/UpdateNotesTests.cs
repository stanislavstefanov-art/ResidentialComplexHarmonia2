using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.UnitTests.Application;

public class UpdateNotesTests
{
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-UN-1"));

    [Fact]
    public async Task Admin_session_returns_Ok()
    {
        var useCase = new UpdateNotes(new FakeSession(AdminCtx), new FakeDirectoryStore());
        Assert.IsType<UpdateNotesResult.Ok>(
            await useCase.ExecuteAsync("HH-TARGET-1", "Parking spot A12"));
    }

    [Fact]
    public async Task Resident_session_returns_Refused()
    {
        var useCase = new UpdateNotes(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        Assert.IsType<UpdateNotesResult.Refused>(
            await useCase.ExecuteAsync("HH-OTHER-1", "some note"));
    }

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var useCase = new UpdateNotes(new FakeSession(null), new FakeDirectoryStore());
        Assert.IsType<UpdateNotesResult.Refused>(
            await useCase.ExecuteAsync("HH-TARGET-1", "note"));
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var useCase = new UpdateNotes(new FakeSession(AdminCtx), new FailingDirectoryStore());
        Assert.IsType<UpdateNotesResult.Failed>(
            await useCase.ExecuteAsync("HH-TARGET-1", "note"));
    }

    [Fact]
    public async Task HouseholdRef_from_parameter_is_forwarded_to_store()
    {
        var store = new FakeDirectoryStore();
        var useCase = new UpdateNotes(new FakeSession(AdminCtx), store);
        await useCase.ExecuteAsync("HH-NOTES-1", "Parking spot A12");

        Assert.Single(store.Contacts);
        Assert.Equal(new HouseholdRef("HH-NOTES-1"), store.Contacts[0].HouseholdRef);
    }
}
