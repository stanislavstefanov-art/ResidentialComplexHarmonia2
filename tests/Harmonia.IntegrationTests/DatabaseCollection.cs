namespace Harmonia.IntegrationTests;

[CollectionDefinition("Database")]
public class DatabaseCollection : ICollectionFixture<SqlServerFixture> { }
