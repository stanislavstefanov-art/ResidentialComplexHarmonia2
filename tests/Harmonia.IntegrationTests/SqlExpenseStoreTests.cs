using Harmonia.Api.Adapters;
using Harmonia.Api.Reservations.Adapters;
using Harmonia.Application.Expenses;
using Harmonia.Domain.Expenses;

namespace Harmonia.IntegrationTests;

[Collection("Database")]
[Trait("Category", "Rel")]
public class SqlExpenseStoreTests(SqlServerFixture db)
{
    private static readonly DateOnly TestDate = new(2026, 7, 1);

    [Fact]
    public async Task Record_and_list_expenses_newest_first()
    {
        var cpStore = new SqlCounterpartyStore(db.ConnectionString);
        var cp1 = await cpStore.CreateAsync($"rel-vendor-{Guid.NewGuid():N}", "Maintenance", "Maintenance", null, null, null);
        var cp2 = await cpStore.CreateAsync($"rel-vendor-{Guid.NewGuid():N}", "Cleaning", "Cleaning", null, null, null);

        var store = new SqlExpenseStore(db.ConnectionString);
        var key1 = $"rel-exp-{Guid.NewGuid():N}";
        var key2 = $"rel-exp-{Guid.NewGuid():N}";

        var r1 = await store.RecordExpenseAsync(
            new AssociationExpense(Guid.NewGuid(), 100m, "Gardening", cp1.Id, TestDate,
                DateTimeOffset.UtcNow.AddMinutes(-1), key1));
        var r2 = await store.RecordExpenseAsync(
            new AssociationExpense(Guid.NewGuid(), 200m, "Cleaning", cp2.Id, TestDate,
                DateTimeOffset.UtcNow, key2));

        Assert.IsType<RecordExpenseResult.Created>(r1);
        Assert.IsType<RecordExpenseResult.Created>(r2);

        var all = await store.ListExpensesAsync();
        var ours = all.Where(e => e.IdempotencyKey == key1 || e.IdempotencyKey == key2)
                      .OrderByDescending(e => e.RecordedAt).ToList();
        Assert.Equal(2, ours.Count);
        Assert.Equal(key2, ours[0].IdempotencyKey);
    }

    [Fact]
    public async Task Duplicate_idempotency_key_returns_Duplicate_with_original_data()
    {
        var cpStore = new SqlCounterpartyStore(db.ConnectionString);
        var cp = await cpStore.CreateAsync($"rel-vendor-{Guid.NewGuid():N}", "Maintenance", "Maintenance", null, null, null);

        var store = new SqlExpenseStore(db.ConnectionString);
        var key = $"rel-dup-{Guid.NewGuid():N}";

        await store.RecordExpenseAsync(
            new AssociationExpense(Guid.NewGuid(), 300m, "Elevator", cp.Id, TestDate,
                DateTimeOffset.UtcNow, key));

        var result = await store.RecordExpenseAsync(
            new AssociationExpense(Guid.NewGuid(), 999m, "Different", cp.Id, TestDate,
                DateTimeOffset.UtcNow, key));

        var dup = Assert.IsType<RecordExpenseResult.Duplicate>(result);
        Assert.Equal(300m, dup.Expense.AmountEur);
        Assert.Equal("Elevator", dup.Expense.Description);
    }

    [Fact]
    public async Task Record_then_List_returns_joined_counterparty_fields()
    {
        var cpStore = new SqlCounterpartyStore(db.ConnectionString);
        var cp = await cpStore.CreateAsync($"rel-vendor-{Guid.NewGuid():N}", "Electricity", "Utilities", null, null, null);

        var store = new SqlExpenseStore(db.ConnectionString);
        var key = $"rel-exp-{Guid.NewGuid():N}";
        await store.RecordExpenseAsync(new AssociationExpense(
            Guid.NewGuid(), 142.50m, "March electricity bill", cp.Id,
            new DateOnly(2026, 3, 31), DateTimeOffset.UtcNow, key));

        var all = await store.ListExpensesAsync();
        var found = Assert.Single(all, e => e.IdempotencyKey == key);
        Assert.Equal(cp.Id, found.CounterpartyId);
        Assert.Equal(cp.Name, found.CounterpartyName);
        Assert.Equal("Electricity", found.CounterpartyCategory);
        Assert.Equal("Utilities", found.CounterpartyParentCategory);
    }

    [Fact]
    public async Task GetAnnualExpensesAsync_groups_by_counterparty_category()
    {
        var cpStore = new SqlCounterpartyStore(db.ConnectionString);
        var cp = await cpStore.CreateAsync($"rel-vendor-{Guid.NewGuid():N}", "Water", "Utilities", null, null, null);

        var store = new SqlExpenseStore(db.ConnectionString);
        var year = 2031; // far-future year avoids collisions with other tests' rows
        await store.RecordExpenseAsync(new AssociationExpense(
            Guid.NewGuid(), 50m, "Test", cp.Id, new DateOnly(year, 5, 1), DateTimeOffset.UtcNow, $"rel-{Guid.NewGuid():N}"));

        var report = await store.GetAnnualExpensesAsync(year);
        var row = Assert.Single(report.Rows, r => r.SubCategory == "Water" && r.MonthNum == 5);
        Assert.Equal("Utilities", row.ParentCategory);
        Assert.Equal(50m, row.Total);
    }
}
