using Harmonia.Application;
using Harmonia.Application.Counterparties;
using Harmonia.Domain;
using Xunit;

namespace Harmonia.UnitTests.Counterparties;

public sealed class CounterpartyUseCaseTests
{
    private static FakeSession Admin()    => new(new SessionContext(IsResident: false, IsAdmin: true,  HouseholdRef: null));
    private static FakeSession Resident() => new(new SessionContext(IsResident: true,  IsAdmin: false, HouseholdRef: new HouseholdRef("X3 АП1")));
    private static FakeSession Anon()      => new(null);

    // ── List ──
    [Fact]
    public async Task List_as_admin_returns_ok()
    {
        var store = new FakeCounterpartyStore();
        await store.CreateAsync("PowerCo", "Electricity", "Utilities", null, null, null);
        var result = await new ListCounterparties(Admin(), store).ExecuteAsync();
        var ok = Assert.IsType<ListCounterpartiesResult.Ok>(result);
        Assert.Single(ok.Counterparties);
    }

    [Fact]
    public async Task List_as_resident_is_refused()
        => Assert.IsType<ListCounterpartiesResult.Refused>(
            await new ListCounterparties(Resident(), new FakeCounterpartyStore()).ExecuteAsync());

    [Fact]
    public async Task List_without_session_is_refused()
        => Assert.IsType<ListCounterpartiesResult.Refused>(
            await new ListCounterparties(Anon(), new FakeCounterpartyStore()).ExecuteAsync());

    [Fact]
    public async Task List_when_store_throws_returns_failed()
        => Assert.IsType<ListCounterpartiesResult.Failed>(
            await new ListCounterparties(Admin(), new FailingCounterpartyStore()).ExecuteAsync());

    // ── Create ──
    [Fact]
    public async Task Create_as_admin_returns_created()
    {
        var result = await new CreateCounterparty(Admin(), new FakeCounterpartyStore())
            .ExecuteAsync("PowerCo", "Electricity", "Utilities", "BG123", "+359", "b@p.bg");
        var created = Assert.IsType<CreateCounterpartyResult.Created>(result);
        Assert.Equal("PowerCo", created.Counterparty.Name);
        Assert.NotEqual(System.Guid.Empty, created.Counterparty.Id);
    }

    [Fact]
    public async Task Create_as_resident_is_refused()
        => Assert.IsType<CreateCounterpartyResult.Refused>(
            await new CreateCounterparty(Resident(), new FakeCounterpartyStore())
                .ExecuteAsync("X", "Y", "Z", null, null, null));

    [Fact]
    public async Task Create_when_store_throws_returns_failed()
        => Assert.IsType<CreateCounterpartyResult.Failed>(
            await new CreateCounterparty(Admin(), new FailingCounterpartyStore())
                .ExecuteAsync("X", "Y", "Z", null, null, null));

    // ── Get ──
    [Fact]
    public async Task Get_missing_returns_not_found()
        => Assert.IsType<GetCounterpartyResult.NotFound>(
            await new GetCounterparty(Admin(), new FakeCounterpartyStore()).ExecuteAsync(System.Guid.NewGuid()));

    [Fact]
    public async Task Get_existing_returns_ok()
    {
        var store = new FakeCounterpartyStore();
        var cp = await store.CreateAsync("PowerCo", "Electricity", "Utilities", null, null, null);
        var ok = Assert.IsType<GetCounterpartyResult.Ok>(
            await new GetCounterparty(Admin(), store).ExecuteAsync(cp.Id));
        Assert.Equal(cp.Id, ok.Counterparty.Id);
    }

    // ── Update ──
    [Fact]
    public async Task Update_existing_returns_ok_with_new_values()
    {
        var store = new FakeCounterpartyStore();
        var cp = await store.CreateAsync("Old", "Electricity", "Utilities", null, null, null);
        var ok = Assert.IsType<UpdateCounterpartyResult.Ok>(
            await new UpdateCounterparty(Admin(), store)
                .ExecuteAsync(cp.Id, "New", "Water", "Utilities", "BG9", null, null));
        Assert.Equal("New", ok.Counterparty.Name);
        Assert.Equal("Water", ok.Counterparty.Category);
    }

    [Fact]
    public async Task Update_missing_returns_not_found()
        => Assert.IsType<UpdateCounterpartyResult.NotFound>(
            await new UpdateCounterparty(Admin(), new FakeCounterpartyStore())
                .ExecuteAsync(System.Guid.NewGuid(), "N", "C", "P", null, null, null));

    [Fact]
    public async Task Update_as_resident_is_refused()
        => Assert.IsType<UpdateCounterpartyResult.Refused>(
            await new UpdateCounterparty(Resident(), new FakeCounterpartyStore())
                .ExecuteAsync(System.Guid.NewGuid(), "N", "C", "P", null, null, null));

    // ── Delete ──
    [Fact]
    public async Task Delete_existing_returns_ok()
    {
        var store = new FakeCounterpartyStore();
        var cp = await store.CreateAsync("PowerCo", "Electricity", "Utilities", null, null, null);
        Assert.IsType<DeleteCounterpartyResult.Ok>(
            await new DeleteCounterparty(Admin(), store).ExecuteAsync(cp.Id));
    }

    [Fact]
    public async Task Delete_missing_returns_not_found()
        => Assert.IsType<DeleteCounterpartyResult.NotFound>(
            await new DeleteCounterparty(Admin(), new FakeCounterpartyStore()).ExecuteAsync(System.Guid.NewGuid()));

    [Fact]
    public async Task Delete_with_bills_returns_has_bills()
    {
        var store = new FakeCounterpartyStore();
        var cp = await store.CreateAsync("PowerCo", "Electricity", "Utilities", null, null, null);
        store.WithBills.Add(cp.Id);
        Assert.IsType<DeleteCounterpartyResult.HasBills>(
            await new DeleteCounterparty(Admin(), store).ExecuteAsync(cp.Id));
    }

    [Fact]
    public async Task Delete_as_resident_is_refused()
        => Assert.IsType<DeleteCounterpartyResult.Refused>(
            await new DeleteCounterparty(Resident(), new FakeCounterpartyStore()).ExecuteAsync(System.Guid.NewGuid()));
}
