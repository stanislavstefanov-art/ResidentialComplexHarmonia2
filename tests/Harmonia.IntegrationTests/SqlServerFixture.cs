using Microsoft.Data.SqlClient;

namespace Harmonia.IntegrationTests;

/// <summary>
/// Provisions the test database on the REAL SQL Server required by the Rel tier.
/// The connection string comes from HARMONIA_SQL_CONNSTR (never committed — CLAUDE.md).
/// If the variable is missing or the server is unreachable this fixture THROWS:
/// the concurrency gate is never skipped and never runs in-memory (stack.md R1).
/// </summary>
public sealed class SqlServerFixture : IAsyncLifetime
{
    private const string TestDatabase = "ReserveBbqTests";

    public string ConnectionString { get; private set; } = string.Empty;

    public async Task InitializeAsync()
    {
        var server = Environment.GetEnvironmentVariable("HARMONIA_SQL_CONNSTR")
            ?? throw new InvalidOperationException(
                "HARMONIA_SQL_CONNSTR is not set. The Rel tier REQUIRES a real SQL Server " +
                "(the R1 concurrency gate is never skipped, never in-memory). Start one per " +
                "docs/context/stack.md (podman run ... mssql/server:2022-latest) and set " +
                "HARMONIA_SQL_CONNSTR to its connection string.");

        await using (var master = new SqlConnection(server))
        {
            await master.OpenAsync();
            await using var create = master.CreateCommand();
            create.CommandText =
                $"IF DB_ID(N'{TestDatabase}') IS NULL CREATE DATABASE [{TestDatabase}];";
            await create.ExecuteNonQueryAsync();
        }

        var builder = new SqlConnectionStringBuilder(server) { InitialCatalog = TestDatabase };
        ConnectionString = builder.ConnectionString;

        var schema = await File.ReadAllTextAsync(
            Path.Combine(AppContext.BaseDirectory, "schema.sql"));
        await using var db = new SqlConnection(ConnectionString);
        await db.OpenAsync();
        await using var apply = db.CreateCommand();
        apply.CommandText = schema;
        await apply.ExecuteNonQueryAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;
}
