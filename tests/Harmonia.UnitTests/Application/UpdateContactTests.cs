using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.UnitTests.Application;

public class UpdateContactTests
{
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-UC-1"));

    private static FakeDirectoryStore StoreLinkedTo(string householdRef, string role = "Owner")
    {
        var store = new FakeDirectoryStore();
        store.Links.Add(($"oid-{Guid.NewGuid():N}", new HouseholdRef(householdRef), role));
        return store;
    }

    [Fact]
    public async Task Admin_session_returns_Ok()
    {
        var useCase = new UpdateContact(new FakeSession(AdminCtx), StoreLinkedTo("HH-TARGET-1"));
        Assert.IsType<UpdateContactResult.Ok>(
            await useCase.ExecuteAsync("HH-TARGET-1", "Owner", "Bob", "555-0200", null));
    }

    [Fact]
    public async Task Resident_session_returns_Refused()
    {
        var useCase = new UpdateContact(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        Assert.IsType<UpdateContactResult.Refused>(
            await useCase.ExecuteAsync("HH-OTHER-1", "Owner", "Bob", null, null));
    }

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var useCase = new UpdateContact(new FakeSession(null), new FakeDirectoryStore());
        Assert.IsType<UpdateContactResult.Refused>(
            await useCase.ExecuteAsync("HH-TARGET-1", "Owner", null, null, null));
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var useCase = new UpdateContact(new FakeSession(AdminCtx), new FailingDirectoryStore());
        Assert.IsType<UpdateContactResult.Failed>(
            await useCase.ExecuteAsync("HH-TARGET-1", "Owner", "Bob", null, null));
    }

    [Fact]
    public async Task HouseholdRef_from_parameter_is_forwarded_to_store()
    {
        var store = StoreLinkedTo("HH-FORWARDED-1");
        var useCase = new UpdateContact(new FakeSession(AdminCtx), store);
        await useCase.ExecuteAsync("HH-FORWARDED-1", "Owner", "Bob", null, null);

        Assert.Single(store.Contacts);
        Assert.Equal(new HouseholdRef("HH-FORWARDED-1"), store.Contacts[0].HouseholdRef);
    }

    [Fact]
    public async Task OptOut_flag_is_forwarded_to_store()
    {
        var store = StoreLinkedTo("HH-OPT-FWD-1");
        var useCase = new UpdateContact(new FakeSession(AdminCtx), store);
        await useCase.ExecuteAsync("HH-OPT-FWD-1", "Owner", null, null, null, isOptedOut: true);

        Assert.Single(store.Contacts);
        Assert.True(store.Contacts[0].IsOptedOut);
    }

    [Fact]
    public async Task Two_residents_sharing_a_role_returns_Ambiguous()
    {
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-AMBIG-1"), "Owner", "Alice", null, null, null,
            false, DateTimeOffset.UtcNow, null, "oid-alice"));
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-AMBIG-1"), "Owner", "Bob", null, null, null,
            false, DateTimeOffset.UtcNow, null, "oid-bob"));

        var useCase = new UpdateContact(new FakeSession(AdminCtx), store);
        var result = await useCase.ExecuteAsync("HH-AMBIG-1", "Owner", "Someone", null, null);

        Assert.IsType<UpdateContactResult.Ambiguous>(result);
        // Neither resident's row was touched.
        Assert.Equal("Alice", store.Contacts.Single(c => c.EntraObjectId == "oid-alice").DisplayName);
        Assert.Equal("Bob",   store.Contacts.Single(c => c.EntraObjectId == "oid-bob").DisplayName);
    }
}
