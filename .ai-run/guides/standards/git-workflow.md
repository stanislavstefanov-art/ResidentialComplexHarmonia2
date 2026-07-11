# Git Workflow

Source: `docs/context/standards/git-workflow.md` (authoritative; this guide is the machine-readable copy).

## Branch Naming Convention

Pattern: `<type>/<slug>`

| Type | Use for |
|---|---|
| `feat/` | New feature or vertical slice |
| `fix/` | Bug fix |
| `refactor/` | Code restructuring with no behaviour change |
| `chore/` | Tooling, deps, CI, configuration |
| `docs/` | Documentation only |

Examples: `feat/reserve-bbq-slot`, `refactor/harmonia-namespaces`, `chore/update-sdk`

One feature or slice per branch. Never commit directly to `master`.

## Commit Message Format

```
<type>: <imperative summary>

<why + what, wrapped ~72 cols. Reference spec AC or plan section where relevant.>
```

Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`

| Avoid | Prefer |
|---|---|
| `fixed the bug` | `fix: reject concurrent claim on same slot` |
| `WIP` commit on master | Branch + `chore:` commit, then PR |
| Ticket prefix (no tracker configured) | Type prefix only |

## Merge Strategy

Squash-merge PRs into `master`; keep `master` linear. All four quality gates (see `quality-gates.md`) must be green before merge. CI must include the Rel concurrency gate.

## Anti-Patterns

| Avoid | Prefer |
|---|---|
| Committing directly to `master` | Always branch: `feat/<slug>` |
| Mixing feature code and tooling in one PR | Separate PRs for separate concerns |
| Merging with a failing Rel gate | All gates green — concurrency gate is non-negotiable |
| Committing secrets or `*.local` config | Gitignored local config only |
| `--no-verify` to bypass hooks | Fix the root cause |

## Troubleshooting

**Rel gate fails in CI:** Ensure `HARMONIA_SQL_CONNSTR` is set in the CI environment pointing to a SQL Server 2022 instance. The fixture throws without it — by design; see `tests/Harmonia.IntegrationTests/SqlServerFixture.cs:19`.

**Conflict after squash-merge:** Branch history diverges from `master` post-squash. Fix: `git reset --hard master && git cherry-pick <new-commits>`, then force-push.
