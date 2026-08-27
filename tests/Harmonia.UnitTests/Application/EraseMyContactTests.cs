using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.UnitTests.Application;

public class EraseMyContactTests
{
    private static readonly SessionContext ResidentCtx = new(
        IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-ERASE-1"),
        EntraObjectId: "oid-erase-1");
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var uc = new EraseMyContact(new FakeSession(null), new FakeDirectoryStore());
        var result = await uc.ExecuteAsync();
        Assert.IsType<EraseContactResult.Refused>(result);
    }

    [Fact]
    public async Task Admin_session_returns_Refused()
    {
        var uc = new EraseMyContact(new FakeSession(AdminCtx), new FakeDirectoryStore());
        var result = await uc.ExecuteAsync();
        Assert.IsType<EraseContactResult.Refused>(result);
    }

    [Fact]
    public async Task Resident_with_no_householdRef_returns_Refused()
    {
        var ctx = new SessionContext(
            IsResident: true, IsAdmin: false, HouseholdRef: null, EntraObjectId: "oid-x");
        var uc = new EraseMyContact(new FakeSession(ctx), new FakeDirectoryStore());
        var result = await uc.ExecuteAsync();
        Assert.IsType<EraseContactResult.Refused>(result);
    }

    [Fact]
    public async Task Resident_without_EntraObjectId_returns_Refused()
    {
        var ctx = new SessionContext(
            IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-ERASE-1"));
        var uc = new EraseMyContact(new FakeSession(ctx), new FakeDirectoryStore());
        var result = await uc.ExecuteAsync();
        Assert.IsType<EraseContactResult.Refused>(result);
    }

    [Fact]
    public async Task Resident_deletes_own_contact_returns_Ok()
    {
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-ERASE-1"), "Owner", "Alice", null, null, null,
            false, DateTimeOffset.UtcNow, null, "oid-erase-1"));
        var uc = new EraseMyContact(new FakeSession(ResidentCtx), store);
        var result = await uc.ExecuteAsync();
        Assert.IsType<EraseContactResult.Ok>(result);
    }

    [Fact]
    public async Task Resident_no_record_returns_NotFound()
    {
        var store = new FakeDirectoryStore();
        var uc = new EraseMyContact(new FakeSession(ResidentCtx), store);
        var result = await uc.ExecuteAsync();
        Assert.IsType<EraseContactResult.NotFound>(result);
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var uc = new EraseMyContact(new FakeSession(ResidentCtx), new FailingDirectoryStore());
        var result = await uc.ExecuteAsync();
        Assert.IsType<EraseContactResult.Failed>(result);
    }

    [Fact]
    public async Task Erasing_own_contact_never_touches_a_co_residents_row()
    {
        // The regression this feature fixes: two residents share HH-ERASE-1 + Owner. Erasing
        // "my" contact must only ever delete the caller's own row, never a co-resident's row
        // sharing the same household and role (previously this deleted the ENTIRE household's
        // contact rows plus its shared PushSubscriptions/NotificationHistory).
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-ERASE-1"), "Owner", "Alice", null, null, null,
            false, DateTimeOffset.UtcNow, null, "oid-erase-1"));
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-ERASE-1"), "Owner", "Housemate", null, null, null,
            false, DateTimeOffset.UtcNow, null, "oid-housemate"));

        var uc = new EraseMyContact(new FakeSession(ResidentCtx), store);
        await uc.ExecuteAsync();

        Assert.Single(store.Contacts);
        Assert.Equal("oid-housemate", store.Contacts[0].EntraObjectId);
    }
}
