# Code Quality Standards

## Quality commands
dotnet build            # must be warning-clean
dotnet test             # all green before commit
dotnet format           # formatting; run before committing

## Enforced rules
- Treat warnings as errors (`<TreatWarningsAsErrors>true</TreatWarningsAsErrors>`), nullable enabled.
- Parameters only for all SQL values (no string interpolation of values into SQL).
- Pure functions for derivation (slot-state, outcome-mapping) — no I/O, unit-tested directly.

## Naming
- PascalCase types/methods/public members; camelCase locals/params.
- Async methods end in `Async`. Test methods describe behavior (`Two_simultaneous_claims_yield_one_winner`).

## Type safety
- Domain outcomes are enums/records, not magic strings/bools (`Claimed` / `AlreadyHeldByMe` / …).
- Money/quantities are typed; never `float`/`double` for money.

## Documentation
- XML doc on public types/methods explaining intent + the invariant they uphold (esp. the claim path).

## Common violations
- App-level read-then-write on the claim path → use the atomic INSERT + 2601/2627 catch (stack.md).
- Logging `householdRef` or any PII → log opaque ids + counts only.