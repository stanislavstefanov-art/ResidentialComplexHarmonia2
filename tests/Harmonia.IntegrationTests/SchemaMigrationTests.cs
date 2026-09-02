using Microsoft.Data.SqlClient;
using Xunit;

namespace Harmonia.IntegrationTests;

/// <summary>
/// schema.sql runs as one unbatched script (no GO). CI and SqlServerFixture always apply it
/// against a brand-new database, so a DML statement referencing a column an earlier ALTER TABLE
/// in the SAME batch just added is masked by deferred name resolution (the table doesn't exist
/// yet at compile time). Against a database where the target table already exists — e.g. prod,
/// which had HouseholdContacts long before the EntraObjectId migration was written — the whole
/// batch is compiled against a pre-batch metadata snapshot and the DML statement fails with
/// "Invalid column name". These tests seed that pre-existing state directly to reproduce it.
/// </summary>
[Collection("Database")]
[Trait("Category", "Rel")]
public sealed class SchemaMigrationTests(SqlServerFixture db)
{
    [Fact]
    public async Task Schema_applies_cleanly_against_pre_existing_HouseholdContacts_without_EntraObjectId()
    {
        var dbName = $"HarmoniaSchemaMigrationTest_{Guid.NewGuid():N}";
        var rootBuilder = new SqlConnectionStringBuilder(db.ConnectionString) { InitialCatalog = "master" };

        await using (var master = new SqlConnection(rootBuilder.ConnectionString))
        {
            await master.OpenAsync();
            await using var create = master.CreateCommand();
            create.CommandText = $"CREATE DATABASE [{dbName}];";
            await create.ExecuteNonQueryAsync();
        }

        try
        {
            var scratchBuilder = new SqlConnectionStringBuilder(db.ConnectionString) { InitialCatalog = dbName };
            await using var conn = new SqlConnection(scratchBuilder.ConnectionString);
            await conn.OpenAsync();

            // Pre-migration state: HouseholdLinks (EntraObjectId PK) and HouseholdContacts
            // (composite HouseholdRef+Role PK, no EntraObjectId column) already exist, as they
            // did in prod before this migration was written.
            await using var seed = conn.CreateCommand();
            seed.CommandText = """
                CREATE TABLE dbo.HouseholdLinks
                (
                    EntraObjectId  nvarchar(36)   NOT NULL,
                    HouseholdRef   nvarchar(128)  NOT NULL,
                    Role           nvarchar(10)   NOT NULL
                        CONSTRAINT DF_HouseholdLinks_Role DEFAULT 'Owner',
                    LinkedAt       datetime2(3)   NOT NULL,
                    CONSTRAINT PK_HouseholdLinks PRIMARY KEY (EntraObjectId)
                );

                CREATE TABLE dbo.HouseholdContacts
                (
                    HouseholdRef  nvarchar(128)     NOT NULL,
                    Role          nvarchar(10)      NOT NULL
                        CONSTRAINT DF_HouseholdContacts_Role DEFAULT 'Owner',
                    DisplayName   nvarchar(256)     NULL,
                    Phone         nvarchar(32)      NULL,
                    Email         nvarchar(320)     NULL,
                    Notes         nvarchar(2048)    NULL,
                    IsOptedOut    bit               NOT NULL
                        CONSTRAINT DF_HouseholdContacts_IsOptedOut DEFAULT 0,
                    UpdatedAt     datetimeoffset(3) NOT NULL,
                    CONSTRAINT PK_HouseholdContacts PRIMARY KEY (HouseholdRef, Role)
                );

                INSERT INTO dbo.HouseholdLinks (EntraObjectId, HouseholdRef, Role, LinkedAt)
                VALUES ('oid-pre-existing', 'HH-1', 'Owner', SYSUTCDATETIME());

                INSERT INTO dbo.HouseholdContacts (HouseholdRef, Role, DisplayName, UpdatedAt)
                VALUES ('HH-1', 'Owner', 'Jane Doe', SYSUTCDATETIME());
                """;
            await seed.ExecuteNonQueryAsync();

            var schema = await File.ReadAllTextAsync(
                Path.Combine(AppContext.BaseDirectory, "schema.sql"));
            await using var apply = conn.CreateCommand();
            apply.CommandText = schema;
            await apply.ExecuteNonQueryAsync();

            await using var verify = conn.CreateCommand();
            verify.CommandText =
                "SELECT EntraObjectId FROM dbo.HouseholdContacts WHERE HouseholdRef = 'HH-1' AND Role = 'Owner';";
            var backfilledOid = (string)(await verify.ExecuteScalarAsync())!;
            Assert.Equal("oid-pre-existing", backfilledOid);
        }
        finally
        {
            SqlConnection.ClearAllPools();
            await using var master = new SqlConnection(rootBuilder.ConnectionString);
            await master.OpenAsync();
            await using var drop = master.CreateCommand();
            drop.CommandText =
                $"ALTER DATABASE [{dbName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{dbName}];";
            await drop.ExecuteNonQueryAsync();
        }
    }
}
