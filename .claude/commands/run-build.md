Run Pipeline 2 (the build) for the feature slug `$ARGUMENTS`.

The plan already exists — do NOT re-brainstorm, re-spec, or re-plan. Ground in the repo's
standing context (`CLAUDE.md`, `docs/context/`, `docs/architecture/decisions/`) and read the
run pack: `runs/$ARGUMENTS/500-implementation.md` (the plan + test table), plus `200-spec.md`
and `900-security-review.md` if present.

Drive, in order:
1. **superpowers:test-driven-development** — implement the 500 plan's test table one red→green
   per test, in dependency order: pure units (fakes, no external deps) first, then integration.
   Any test the plan marks as a load-bearing invariant (concurrency, authorization, data
   integrity) runs against the REAL dependency the plan names — never a stand-in — and CI fails
   loudly if that dependency is unreachable.
2. **superpowers:requesting-code-review** — with the run pack's spec + security + ADRs as the
   review bundle. Confirm every acceptance criterion maps to a test and the plan's core
   invariants hold.
3. **sdlc-factory:qa-gates** — run the gates the run pack defines.
4. **sdlc-factory:mr-creator** — open the MR with spec→plan→ADR→tests provenance.

Honor the build rules in `CLAUDE.md` (test-first, no secrets, the project's layering). Stop and
ask on anything that touches a `context/cold/gap-log.md` gap.