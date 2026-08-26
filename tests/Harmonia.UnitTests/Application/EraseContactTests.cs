using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.UnitTests.Application;

public class EraseContactTests
{
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-RES-1"));
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var uc = new EraseContact(new FakeSession(null), new FakeDirectoryStore());
        var result = await uc.ExecuteAsync("HH-TARGET-1");
        Assert.IsType<EraseContactResult.Refused>(result);
    }

    [Fact]
    public async Task Resident_session_returns_Refused()
    {
        var uc = new EraseContact(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        var result = await uc.ExecuteAsync("HH-TARGET-1");
        Assert.IsType<EraseContactResult.Refused>(result);
    }

    [Fact]
    public async Task Admin_deletes_contact_returns_Ok()
    {
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-TARGET-1"), "Owner", "Carol", null, null, null,
            false, DateTimeOffset.UtcNow, null, "oid-carol"));
        var uc = new EraseContact(new FakeSession(AdminCtx), store);
        var result = await uc.ExecuteAsync("HH-TARGET-1");
        Assert.IsType<EraseContactResult.Ok>(result);
    }

    [Fact]
    public async Task Role_defaults_to_Owner_when_not_specified()
    {
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-TARGET-1"), "Renter", "Not Targeted", null, null, null,
            false, DateTimeOffset.UtcNow, null, "oid-renter"));
        var uc = new EraseContact(new FakeSession(AdminCtx), store);

        // No role passed — defaults to "Owner", which doesn't match the seeded "Renter" row.
        var result = await uc.ExecuteAsync("HH-TARGET-1");

        Assert.IsType<EraseContactResult.NotFound>(result);
        Assert.Single(store.Contacts); // untouched
    }

    [Fact]
    public async Task Explicit_role_is_forwarded_to_store()
    {
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-TARGET-1"), "Renter", "Targeted", null, null, null,
            false, DateTimeOffset.UtcNow, null, "oid-renter"));
        var uc = new EraseContact(new FakeSession(AdminCtx), store);

        var result = await uc.ExecuteAsync("HH-TARGET-1", "Renter");

        Assert.IsType<EraseContactResult.Ok>(result);
        Assert.Empty(store.Contacts);
    }

    [Fact]
    public async Task Admin_target_not_found_returns_NotFound()
    {
        var store = new FakeDirectoryStore();
        var uc = new EraseContact(new FakeSession(AdminCtx), store);
        var result = await uc.ExecuteAsync("HH-TARGET-1");
        Assert.IsType<EraseContactResult.NotFound>(result);
    }

    [Fact]
    public async Task Two_residents_sharing_a_role_returns_Ambiguous_and_deletes_neither()
    {
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-AMBIG-1"), "Owner", "Alice", null, null, null,
            false, DateTimeOffset.UtcNow, null, "oid-alice"));
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-AMBIG-1"), "Owner", "Bob", null, null, null,
            false, DateTimeOffset.UtcNow, null, "oid-bob"));

        var uc = new EraseContact(new FakeSession(AdminCtx), store);
        var result = await uc.ExecuteAsync("HH-AMBIG-1", "Owner");

        Assert.IsType<EraseContactResult.Ambiguous>(result);
        Assert.Equal(2, store.Contacts.Count);
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var uc = new EraseContact(new FakeSession(AdminCtx), new FailingDirectoryStore());
        var result = await uc.ExecuteAsync("HH-TARGET-1");
        Assert.IsType<EraseContactResult.Failed>(result);
    }
}
