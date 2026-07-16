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
            new HouseholdRef("HH-TARGET-1"), "Carol", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: null));
        var uc = new EraseContact(new FakeSession(AdminCtx), store);
        var result = await uc.ExecuteAsync("HH-TARGET-1");
        Assert.IsType<EraseContactResult.Ok>(result);
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
    public async Task Store_failure_returns_Failed()
    {
        var uc = new EraseContact(new FakeSession(AdminCtx), new FailingDirectoryStore());
        var result = await uc.ExecuteAsync("HH-TARGET-1");
        Assert.IsType<EraseContactResult.Failed>(result);
    }
}
