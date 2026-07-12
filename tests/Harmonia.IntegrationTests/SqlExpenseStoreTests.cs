using Harmonia.Api.Reservations.Adapters;
using Harmonia.Application.Expenses;
using Harmonia.Domain.Expenses;

namespace Harmonia.IntegrationTests;

[Trait("Category", "Rel")]
public class SqlExpenseStoreTests(SqlServerFixture db) : IClassFixture<SqlServerFixture>
{
    private static readonly DateOnly TestDate = new(2026, 7, 1);

    [Fact]
    public async Task Record_and_list_expenses_newest_first()
    {
        var store = new SqlExpenseStore(db.ConnectionString);
        var key1 = $"rel-exp-{Guid.NewGuid():N}";
        var key2 = $"rel-exp-{Guid.NewGuid():N}";

        var r1 = await store.RecordExpenseAsync(
            new AssociationExpense(Guid.NewGuid(), 100m, "Gardening", "Maintenance", TestDate,
                DateTimeOffset.UtcNow.AddMinutes(-1), key1));
        var r2 = await store.RecordExpenseAsync(
            new AssociationExpense(Guid.NewGuid(), 200m, "Cleaning", "Cleaning", TestDate,
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
        var store = new SqlExpenseStore(db.ConnectionString);
        var key = $"rel-dup-{Guid.NewGuid():N}";

        await store.RecordExpenseAsync(
            new AssociationExpense(Guid.NewGuid(), 300m, "Elevator", "Maintenance", TestDate,
                DateTimeOffset.UtcNow, key));

        var result = await store.RecordExpenseAsync(
            new AssociationExpense(Guid.NewGuid(), 999m, "Different", "Other", TestDate,
                DateTimeOffset.UtcNow, key));

        var dup = Assert.IsType<RecordExpenseResult.Duplicate>(result);
        Assert.Equal(300m, dup.Expense.AmountEur);
        Assert.Equal("Elevator", dup.Expense.Description);
    }
}
