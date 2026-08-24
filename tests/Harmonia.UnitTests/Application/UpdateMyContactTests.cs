using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.UnitTests.Application;

public class UpdateMyContactTests
{
    private static readonly SessionContext ResidentCtx = new(
        IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-MC-1"),
        EntraObjectId: "oid-mc-1");
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    private static FakeDirectoryStore StoreLinkedForResident()
    {
        var store = new FakeDirectoryStore();
        store.Links.Add(("oid-mc-1", new HouseholdRef("HH-MC-1"), "Owner"));
        return store;
    }

    [Fact]
    public async Task Resident_with_HouseholdRef_returns_Ok()
    {
        var useCase = new UpdateMyContact(new FakeSession(ResidentCtx), StoreLinkedForResident());
        Assert.IsType<UpdateContactResult.Ok>(
            await useCase.ExecuteAsync("Alice", "555-0100", "alice@example.com"));
    }

    [Fact]
    public async Task Admin_without_HouseholdRef_returns_Refused()
    {
        var useCase = new UpdateMyContact(new FakeSession(AdminCtx), new FakeDirectoryStore());
        Assert.IsType<UpdateContactResult.Refused>(
            await useCase.ExecuteAsync("Admin", null, null));
    }

    [Fact]
    public async Task Admin_with_HouseholdRef_returns_Ok()
    {
        var ctx = new SessionContext(
            IsResident: false, IsAdmin: true, HouseholdRef: new HouseholdRef("HH-MC-1"),
            EntraObjectId: "oid-admin-mc-1");
        var store = new FakeDirectoryStore();
        store.Links.Add(("oid-admin-mc-1", new HouseholdRef("HH-MC-1"), "Owner"));
        var useCase = new UpdateMyContact(new FakeSession(ctx), store);
        Assert.IsType<UpdateContactResult.Ok>(
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
        var ctx = new SessionContext(
            IsResident: true, IsAdmin: false, HouseholdRef: null, EntraObjectId: "oid-no-hh");
        var useCase = new UpdateMyContact(new FakeSession(ctx), new FakeDirectoryStore());
        Assert.IsType<UpdateContactResult.Refused>(
            await useCase.ExecuteAsync("Alice", null, null));
    }

    [Fact]
    public async Task Resident_without_EntraObjectId_returns_Refused()
    {
        var ctx = new SessionContext(
            IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-MC-1"));
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
        var store = StoreLinkedForResident();
        var useCase = new UpdateMyContact(new FakeSession(ResidentCtx), store);
        await useCase.ExecuteAsync("Alice", "555-0100", null);

        Assert.Single(store.Contacts);
        Assert.Equal(new HouseholdRef("HH-MC-1"), store.Contacts[0].HouseholdRef);
    }

    [Fact]
    public async Task OptOut_flag_is_forwarded_to_store()
    {
        var store = StoreLinkedForResident();
        var useCase = new UpdateMyContact(new FakeSession(ResidentCtx), store);
        await useCase.ExecuteAsync(null, null, null, isOptedOut: true);

        Assert.Single(store.Contacts);
        Assert.True(store.Contacts[0].IsOptedOut);
    }

    [Fact]
    public async Task Editing_own_contact_never_touches_a_co_residents_row()
    {
        // The regression this feature fixes: two residents share HH-MC-1 + Owner. Editing "my"
        // contact must only ever affect the caller's own row, identified by OID, never a
        // co-resident's row sharing the same household and role.
        var store = StoreLinkedForResident();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-MC-1"), "Owner", "Housemate", "555-9999", "housemate@example.com",
            null, false, DateTimeOffset.UtcNow, null, "oid-housemate"));
        var useCase = new UpdateMyContact(new FakeSession(ResidentCtx), store);

        await useCase.ExecuteAsync("Alice", "555-0100", "alice@example.com");

        Assert.Equal(2, store.Contacts.Count);
        var housemate = store.Contacts.Single(c => c.EntraObjectId == "oid-housemate");
        Assert.Equal("Housemate", housemate.DisplayName);
        Assert.Equal("555-9999", housemate.Phone);
        var mine = store.Contacts.Single(c => c.EntraObjectId == "oid-mc-1");
        Assert.Equal("Alice", mine.DisplayName);
    }
}
