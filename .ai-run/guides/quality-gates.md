# Quality Gates

All four gates must be green before every PR merge. Run in this order (fastest first).

### Format

**Run**: `dotnet format --verify-no-changes Harmonia.sln`
**Pass**: Exit 0, no output
**Fail**: Lists files with formatting violations
**Auto-fix**: `dotnet format Harmonia.sln`

### Build

**Run**: `dotnet build Harmonia.sln`
**Pass**: `Build succeeded. 0 Warning(s) 0 Error(s)`
**Fail**: Any warning or error — `TreatWarningsAsErrors=true` makes warnings fatal (`Directory.Build.props:9`)

### Unit Tests

**Run**: `dotnet test Harmonia.sln --filter "Category!=Rel"`
**Pass**: All 27 tests pass, 0 failures
**Fail**: Any test failure

### Rel Gate (integration + concurrency)

**Run**: `dotnet test Harmonia.sln --filter "Category=Rel"`
**Pass**: All 7 tests pass, including `Two_simultaneous_claims_yield_one_winner`
**Fail**: Any test failure, OR `HARMONIA_SQL_CONNSTR` unset (fixture throws — `tests/Harmonia.IntegrationTests/SqlServerFixture.cs:19`)
**Skip if**: **Never.** This gate is the only proof of the R1 no-double-booking guarantee on a real SQL Server 2022 engine. A skipped Rel gate is a broken build.

**Local setup:**
1. `podman restart harmonia-mssql` (wait ~15 s for SQL engine login)
2. Set `HARMONIA_SQL_CONNSTR` from `sqlconn.local` (gitignored)
3. Run the gate
