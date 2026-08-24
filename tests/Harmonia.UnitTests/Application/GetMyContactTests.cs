using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.UnitTests.Application;

public class GetMyContactTests
{
    private static readonly SessionContext ResidentCtx = new(
        IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-GMC-1"),
        EntraObjectId: "oid-gmc-1");
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var uc = new GetMyContact(new FakeSession(null), new FakeDirectoryStore());
        Assert.IsType<GetMyContactResult.Refused>(await uc.ExecuteAsync());
    }

    [Fact]
    public async Task Resident_without_HouseholdRef_returns_Refused()
    {
        var ctx = new SessionContext(
            IsResident: true, IsAdmin: false, HouseholdRef: null, EntraObjectId: "oid-x");
        var uc = new GetMyContact(new FakeSession(ctx), new FakeDirectoryStore());
        Assert.IsType<GetMyContactResult.Refused>(await uc.ExecuteAsync());
    }

    [Fact]
    public async Task Resident_without_EntraObjectId_returns_Refused()
    {
        var ctx = new SessionContext(
            IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-X"));
        var uc = new GetMyContact(new FakeSession(ctx), new FakeDirectoryStore());
        Assert.IsType<GetMyContactResult.Refused>(await uc.ExecuteAsync());
    }

    [Fact]
    public async Task Admin_with_HouseholdRef_and_EntraObjectId_returns_Ok()
    {
        var ctx = new SessionContext(
            IsResident: false, IsAdmin: true, HouseholdRef: new HouseholdRef("HH-GMC-2"),
            EntraObjectId: "oid-admin-gmc");
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-GMC-2"), "Owner", "Admin Self", null, null, null,
            false, DateTimeOffset.UtcNow, null, "oid-admin-gmc"));
        var uc = new GetMyContact(new FakeSession(ctx), store);
        Assert.IsType<GetMyContactResult.Ok>(await uc.ExecuteAsync());
    }

    [Fact]
    public async Task Resident_with_a_contact_row_returns_Ok()
    {
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-GMC-1"), "Owner", "Alice", null, null, null,
            false, DateTimeOffset.UtcNow, null, "oid-gmc-1"));
        var uc = new GetMyContact(new FakeSession(ResidentCtx), store);
        var result = Assert.IsType<GetMyContactResult.Ok>(await uc.ExecuteAsync());
        Assert.Equal("Alice", result.Contact.DisplayName);
    }

    [Fact]
    public async Task Resident_with_no_contact_row_returns_NotFound()
    {
        var uc = new GetMyContact(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        Assert.IsType<GetMyContactResult.NotFound>(await uc.ExecuteAsync());
    }

    [Fact]
    public async Task Never_returns_a_co_residents_contact_even_when_role_matches()
    {
        // The regression this feature fixes: two residents share HH-GMC-1 + Owner. GetMyContact
        // must resolve strictly by the caller's own OID, never by (HouseholdRef, Role) — the old
        // "try the other role" fallback this task deletes is exactly what could return the wrong
        // person's data here.
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-GMC-1"), "Owner", "Housemate", null, null, null,
            false, DateTimeOffset.UtcNow, null, "oid-housemate"));
        var uc = new GetMyContact(new FakeSession(ResidentCtx), store);
        Assert.IsType<GetMyContactResult.NotFound>(await uc.ExecuteAsync());
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var uc = new GetMyContact(new FakeSession(ResidentCtx), new FailingDirectoryStore());
        Assert.IsType<GetMyContactResult.Failed>(await uc.ExecuteAsync());
    }
}
