using Microsoft.Data.SqlClient;
using Harmonia.Api.Reservations.Adapters;
using Harmonia.Domain;
using Harmonia.Domain.Reservations;

namespace Harmonia.IntegrationTests;

// T11–T18 (500 plan test table): the store adapter against a REAL SQL Server.
// The engine's unique key decides every race (R1, ADR-0002) — never in-memory.
[Trait("Category", "Rel")]
public class SqlReservationStoreTests(SqlServerFixture fixture) : IClassFixture<SqlServerFixture>
{
    private static readonly DateOnly Day = new(2026, 7, 18);
    private static readonly HouseholdRef HouseholdA = new("HH-A");
    private static readonly HouseholdRef HouseholdB = new("HH-B");

    private SqlReservationStore Store => new(fixture.ConnectionString);

    /// <summary>Each test claims its own slot key so tests never contend with each other.</summary>
    private static string FreshSlotKey() => $"T-{Guid.NewGuid():N}";

    [Fact] // T11 — single claim on a free slot commits the holder (AC-2)
    public async Task Single_claim_on_free_slot_commits_holder()
    {
        var slot = FreshSlotKey();

        var result = await Store.ClaimSlotAsync(Day, slot, HouseholdA);

        Assert.Equal(ClaimResult.Claimed, result);
        var holders = await Store.GetDayHoldersAsync(Day);
        Assert.Equal(HouseholdA, holders[slot]);
    }

    [Fact] // T12 — second sequential claim is refused and the holder is unchanged (AC-5/NFR-4)
    public async Task Second_sequential_claim_returns_already_held_and_holder_unchanged()
    {
        var slot = FreshSlotKey();
        await Store.ClaimSlotAsync(Day, slot, HouseholdA);

        var second = await Store.ClaimSlotAsync(Day, slot, HouseholdB);

        Assert.Equal(ClaimResult.AlreadyHeldByOther, second);
        var holders = await Store.GetDayHoldersAsync(Day);
        Assert.Equal(HouseholdA, holders[slot]); // original hold untouched
    }

    [Fact] // T13 — THE load-bearing proof: two simultaneous claims, exactly one winner (AC-4/NFR-1)
    public async Task Two_simultaneous_claims_yield_exactly_one_winner()
    {
        var slot = FreshSlotKey();
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        var claimA = ClaimAfterGateAsync(gate.Task, slot, HouseholdA);
        var claimB = ClaimAfterGateAsync(gate.Task, slot, HouseholdB);
        gate.SetResult(); // release both claims at the same instant
        var results = await Task.WhenAll(claimA, claimB);

        Assert.Single(results, r => r == ClaimResult.Claimed);
        Assert.Single(results, r => r == ClaimResult.AlreadyHeldByOther);
        var winner = results[0] == ClaimResult.Claimed ? HouseholdA : HouseholdB;
        var holders = await Store.GetDayHoldersAsync(Day);
        Assert.Equal(winner, holders[slot]);
    }

    [Fact] // T14 — repeated concurrent claims never leave two holders or no holder (AC-4)
    public async Task Concurrent_claims_never_leave_two_holders_or_no_holder()
    {
        for (var i = 0; i < 10; i++)
        {
            var slot = FreshSlotKey();
            var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

            var claimA = ClaimAfterGateAsync(gate.Task, slot, HouseholdA);
            var claimB = ClaimAfterGateAsync(gate.Task, slot, HouseholdB);
            gate.SetResult();
            var results = await Task.WhenAll(claimA, claimB);

            Assert.Single(results, r => r == ClaimResult.Claimed);
            Assert.Equal(1, await CountRowsAsync(slot)); // exactly one holder row, always
        }
    }

    [Fact] // T15 — retry of my own confirmed claim is idempotent (R2)
    public async Task Retry_of_own_confirmed_claim_returns_already_held_by_me()
    {
        var slot = FreshSlotKey();
        await Store.ClaimSlotAsync(Day, slot, HouseholdA);

        // The client saw "couldn't-confirm" and re-submits the same claim.
        var retry = await Store.ClaimSlotAsync(Day, slot, HouseholdA);

        Assert.Equal(ClaimResult.AlreadyHeldByMe, retry);
    }

    [Fact] // T17 — a just-committed claim is visible to the next read (R3/NFR-2, no cache)
    public async Task Read_reflects_a_just_committed_claim()
    {
        var slot = FreshSlotKey();

        await Store.ClaimSlotAsync(Day, slot, HouseholdA);
        var holders = await Store.GetDayHoldersAsync(Day);

        Assert.True(holders.ContainsKey(slot), "a committed claim must be immediately visible");
    }

    [Fact] // T18 — unreachable store: couldn't-confirm, and no partial holder anywhere (C5/NFR-4)
    public async Task Unreachable_store_returns_unavailable_and_writes_nothing()
    {
        var slot = FreshSlotKey();
        var dead = new SqlConnectionStringBuilder(fixture.ConnectionString)
        {
            DataSource = "127.0.0.1,59999", // nothing listens here
            ConnectTimeout = 2,
        };
        var deadStore = new SqlReservationStore(dead.ConnectionString);

        var result = await deadStore.ClaimSlotAsync(Day, slot, HouseholdA);

        Assert.Equal(ClaimResult.Unavailable, result);
        Assert.Equal(0, await CountRowsAsync(slot)); // no partial holder on the real store
    }

    private async Task<ClaimResult> ClaimAfterGateAsync(
        Task gate, string slotKey, HouseholdRef household)
    {
        var store = Store; // one store (and its own connection) per concurrent caller
        await gate;
        return await store.ClaimSlotAsync(Day, slotKey, household);
    }

    private async Task<int> CountRowsAsync(string slotKey)
    {
        await using var conn = new SqlConnection(fixture.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT COUNT(*) FROM dbo.Reservations WHERE DayDate = @Day AND SlotKey = @SlotKey;";
        cmd.Parameters.Add(new SqlParameter("@Day", System.Data.SqlDbType.Date)
        {
            Value = Day.ToDateTime(TimeOnly.MinValue),
        });
        cmd.Parameters.AddWithValue("@SlotKey", slotKey);
        return (int)(await cmd.ExecuteScalarAsync() ?? 0);
    }
}
