Run Pipeline 2 (the build) for the feature slug `$ARGUMENTS`.

The plan already exists — do NOT re-brainstorm, re-spec, or re-plan. Ground in the repo's context
(`CLAUDE.md`, `docs/context/stack.md`, `docs/context/architecture.md`, `docs/architecture/decisions/`)
and read the run pack: `runs/$ARGUMENTS/500-implementation.md` (the plan + test table),
`200-spec.md`, `900-security-review.md`.

Drive, in order:
1. **superpowers:test-driven-development** — implement the 500 plan's test table one red→green per
   test, dependency order: pure units (fakes, no DB) first, then integration + the core-invariant /
   concurrency test on a **REAL store** (never in-memory; CI fails loudly if unreachable).
2. **superpowers:requesting-code-review** — with the bundle `200-spec.md` + `900-security-review.md`
   + the ADRs. Verify the core invariants (R1/R2/R3) and every AC↔test.
3. **sdlc-factory:qa-gates** — lint + unit + integration + concurrency.
4. **sdlc-factory:mr-creator** — open the MR with spec→plan→ADR→tests provenance.

Honor `CLAUDE.md`'s build rules (test-first, no secrets, the layering). Stop and ask on anything
touching a `context/cold/gap-log.md` gap.