using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.UnitTests.Application;

public class MarkDepartedTests
{
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-MD-1"));
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var uc = new MarkDeparted(new FakeSession(null), new FakeDirectoryStore());
        var result = await uc.ExecuteAsync("HH-TARGET-1");
        Assert.IsType<MarkDepartedResult.Refused>(result);
    }

    [Fact]
    public async Task Resident_session_returns_Refused()
    {
        var uc = new MarkDeparted(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        var result = await uc.ExecuteAsync("HH-TARGET-1");
        Assert.IsType<MarkDepartedResult.Refused>(result);
    }

    [Fact]
    public async Task Admin_marks_existing_contact_returns_Ok()
    {
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-TARGET-1"), "Alice", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: null));
        var uc = new MarkDeparted(new FakeSession(AdminCtx), store);
        var result = await uc.ExecuteAsync("HH-TARGET-1");
        Assert.IsType<MarkDepartedResult.Ok>(result);
    }

    [Fact]
    public async Task Admin_target_not_found_returns_NotFound()
    {
        var uc = new MarkDeparted(new FakeSession(AdminCtx), new FakeDirectoryStore());
        var result = await uc.ExecuteAsync("HH-NONEXISTENT");
        Assert.IsType<MarkDepartedResult.NotFound>(result);
    }

    [Fact]
    public async Task MarkDeparted_is_idempotent_second_call_returns_Ok_and_preserves_original_date()
    {
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-TARGET-2"), "Bob", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: null));
        var uc = new MarkDeparted(new FakeSession(AdminCtx), store);

        // First call — sets DepartedAt
        await uc.ExecuteAsync("HH-TARGET-2");
        var firstDepartedAt = store.Contacts[0].DepartedAt;
        Assert.NotNull(firstDepartedAt);

        // Second call — idempotent; must return Ok and must NOT change the original date
        var result = await uc.ExecuteAsync("HH-TARGET-2");
        Assert.IsType<MarkDepartedResult.Ok>(result);
        Assert.Equal(firstDepartedAt, store.Contacts[0].DepartedAt);
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var uc = new MarkDeparted(new FakeSession(AdminCtx), new FailingDirectoryStore());
        var result = await uc.ExecuteAsync("HH-TARGET-1");
        Assert.IsType<MarkDepartedResult.Failed>(result);
    }
}
