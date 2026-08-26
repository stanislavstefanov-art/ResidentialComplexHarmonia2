using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.UnitTests.Application;

public class RemoveResidentTests
{
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-RR-1"));
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var uc = new RemoveResident(new FakeSession(null), new FakeDirectoryStore());
        Assert.IsType<RemoveResidentResult.Refused>(await uc.ExecuteAsync("HH-TARGET-1", "Owner"));
    }

    [Fact]
    public async Task Resident_session_returns_Refused()
    {
        var uc = new RemoveResident(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        Assert.IsType<RemoveResidentResult.Refused>(await uc.ExecuteAsync("HH-TARGET-1", "Owner"));
    }

    [Fact]
    public async Task Admin_removes_existing_resident_returns_Ok()
    {
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-TARGET-1"), "Owner", "Alice", null, null, null,
            false, DateTimeOffset.UtcNow, null, "oid-alice"));
        store.Links.Add(("oid-alice", new HouseholdRef("HH-TARGET-1"), "Owner"));
        var uc = new RemoveResident(new FakeSession(AdminCtx), store);

        var result = await uc.ExecuteAsync("HH-TARGET-1", "Owner");

        Assert.IsType<RemoveResidentResult.Ok>(result);
        Assert.Empty(store.Contacts);
    }

    [Fact]
    public async Task Admin_target_not_found_returns_NotFound()
    {
        var uc = new RemoveResident(new FakeSession(AdminCtx), new FakeDirectoryStore());
        Assert.IsType<RemoveResidentResult.NotFound>(await uc.ExecuteAsync("HH-NONEXISTENT", "Owner"));
    }

    [Fact]
    public async Task Two_residents_sharing_a_role_returns_Ambiguous_and_removes_neither()
    {
        // The most serious variant of the original bug: admin "removing" one resident by role
        // must never deactivate two people's accounts at once.
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-AMBIG-1"), "Owner", "Alice", null, null, null,
            false, DateTimeOffset.UtcNow, null, "oid-alice"));
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-AMBIG-1"), "Owner", "Bob", null, null, null,
            false, DateTimeOffset.UtcNow, null, "oid-bob"));
        store.Links.Add(("oid-alice", new HouseholdRef("HH-AMBIG-1"), "Owner"));
        store.Links.Add(("oid-bob",   new HouseholdRef("HH-AMBIG-1"), "Owner"));
        var uc = new RemoveResident(new FakeSession(AdminCtx), store);

        var result = await uc.ExecuteAsync("HH-AMBIG-1", "Owner");

        Assert.IsType<RemoveResidentResult.Ambiguous>(result);
        Assert.Equal(2, store.Contacts.Count);
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var uc = new RemoveResident(new FakeSession(AdminCtx), new FailingDirectoryStore());
        Assert.IsType<RemoveResidentResult.Failed>(await uc.ExecuteAsync("HH-TARGET-1", "Owner"));
    }
}
