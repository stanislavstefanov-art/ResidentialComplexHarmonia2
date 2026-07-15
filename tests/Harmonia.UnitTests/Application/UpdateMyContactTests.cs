using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.UnitTests.Application;

public class UpdateMyContactTests
{
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-MC-1"));
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    [Fact]
    public async Task Resident_with_HouseholdRef_returns_Ok()
    {
        var useCase = new UpdateMyContact(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        Assert.IsType<UpdateContactResult.Ok>(
            await useCase.ExecuteAsync("Alice", "555-0100", "alice@example.com"));
    }

    [Fact]
    public async Task Admin_session_returns_Refused()
    {
        var useCase = new UpdateMyContact(new FakeSession(AdminCtx), new FakeDirectoryStore());
        Assert.IsType<UpdateContactResult.Refused>(
            await useCase.ExecuteAsync("Admin", null, null));
    }

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var useCase = new UpdateMyContact(new FakeSession(null), new FakeDirectoryStore());
        Assert.IsType<UpdateContactResult.Refused>(
            await useCase.ExecuteAsync(null, null, null));
    }

    [Fact]
    public async Task Resident_without_HouseholdRef_returns_Refused()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
        var useCase = new UpdateMyContact(new FakeSession(ctx), new FakeDirectoryStore());
        Assert.IsType<UpdateContactResult.Refused>(
            await useCase.ExecuteAsync("Alice", null, null));
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var useCase = new UpdateMyContact(new FakeSession(ResidentCtx), new FailingDirectoryStore());
        Assert.IsType<UpdateContactResult.Failed>(
            await useCase.ExecuteAsync("Alice", null, null));
    }

    [Fact]
    public async Task HouseholdRef_comes_from_session_not_parameters()
    {
        var store = new FakeDirectoryStore();
        var useCase = new UpdateMyContact(new FakeSession(ResidentCtx), store);
        await useCase.ExecuteAsync("Alice", "555-0100", null);

        Assert.Single(store.Contacts);
        Assert.Equal(new HouseholdRef("HH-MC-1"), store.Contacts[0].HouseholdRef);
    }

    [Fact]
    public async Task OptOut_flag_is_forwarded_to_store()
    {
        var store = new FakeDirectoryStore();
        var useCase = new UpdateMyContact(new FakeSession(ResidentCtx), store);
        await useCase.ExecuteAsync(null, null, null, isOptedOut: true);

        Assert.Single(store.Contacts);
        Assert.True(store.Contacts[0].IsOptedOut);
    }
}
