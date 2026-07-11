# Git Workflow

## Branch naming
`feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`. One feature/slice per branch.
Never commit directly to `main`.

## Commit message format
<type>: <imperative summary>

<why + what, wrapped ~72 cols>
Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`. Reference the AC/spec where relevant.

## Merge strategy
- PR into `main`; CI (build + test incl. the real-SQL-Server concurrency gate) must be green.
- Squash-merge; keep `main` linear.

## Anti-patterns
- Mixing unrelated changes in one PR (keep feature vs tooling/docs separate).
- Bypassing CI / merging red. The concurrency gate is required, never skipped.
- Committing secrets or `*.local` config.