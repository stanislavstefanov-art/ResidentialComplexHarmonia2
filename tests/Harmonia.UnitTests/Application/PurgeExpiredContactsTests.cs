using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.UnitTests.Application;

public class PurgeExpiredContactsTests
{
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-PEC-1"));
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var uc = new PurgeExpiredContacts(new FakeSession(null), new FakeDirectoryStore());
        var result = await uc.ExecuteAsync();
        Assert.IsType<PurgeExpiredContactsResult.Refused>(result);
    }

    [Fact]
    public async Task Resident_session_returns_Refused()
    {
        var uc = new PurgeExpiredContacts(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        var result = await uc.ExecuteAsync();
        Assert.IsType<PurgeExpiredContactsResult.Refused>(result);
    }

    [Fact]
    public async Task Admin_purges_expired_rows_returns_correct_count()
    {
        var store = new FakeDirectoryStore();
        var expiredDate = DateTimeOffset.UtcNow.AddYears(-1).AddDays(-1);
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-EXP-A"), "Alice", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: expiredDate));
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-EXP-B"), "Bob", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: expiredDate));

        var uc = new PurgeExpiredContacts(new FakeSession(AdminCtx), store);
        var result = await uc.ExecuteAsync();

        var ok = Assert.IsType<PurgeExpiredContactsResult.Ok>(result);
        Assert.Equal(2, ok.Deleted);
        Assert.Empty(store.Contacts);
    }

    [Fact]
    public async Task Admin_no_eligible_rows_returns_zero()
    {
        var store = new FakeDirectoryStore();
        // Active resident — DepartedAt is null; must NOT be purged
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-ACTIVE"), "Carol", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: null));

        var uc = new PurgeExpiredContacts(new FakeSession(AdminCtx), store);
        var result = await uc.ExecuteAsync();

        var ok = Assert.IsType<PurgeExpiredContactsResult.Ok>(result);
        Assert.Equal(0, ok.Deleted);
        Assert.Single(store.Contacts); // contact untouched
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var uc = new PurgeExpiredContacts(new FakeSession(AdminCtx), new FailingDirectoryStore());
        var result = await uc.ExecuteAsync();
        Assert.IsType<PurgeExpiredContactsResult.Failed>(result);
    }
}
