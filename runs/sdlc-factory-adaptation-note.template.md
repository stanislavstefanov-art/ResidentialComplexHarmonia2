# sdlc-factory Adaptation Note -- [feature-slug]

Use this only if you attempted Lane 2.

## Access preflight

- [ ] Approved plugin host available.
- [ ] CodeMie marketplace access available.
- [ ] You are allowed to install plugins or skills in the sandbox.
- [ ] No client repository or restricted data is used without approval.

## No-access path

Use this section when you cannot access the implementation.

- **Missing access:** [plugin host / marketplace / install approval / repository]
- **Docs inspected:** [files or notes you could inspect]
- **Question for factory owner:** [one concrete access or architecture question]
- **Recommendation:** `defer`

## System of Agency mapping

| Part | Hand-wired factory | Existing EPAM implementation | Fit / gap |
|------|--------------------|------------------------------|-----------|
| Station registry | `.claude/agents/*.md` / `station-slots/*.md` | | |
| Handoff graph | `handoff-map.yaml` / `CLAUDE.md` | | |
| Context substrate | files and station specs | | |
| Run protocol | `CLAUDE.md` / `AGENTS.md` / manual prompts | | |
| Human gates | `human-gates.md` | | |
| Verification layer | `eval-report.md` and tests | | |
| Telemetry / run record | transcript, cost log, run record | | |

## Guide mapping

| Course station or source | Candidate guide |
|--------------------------|-----------------|
| Project framing / consulting / product | `.ai-run/guides/project.md` |
| Engineering practices | `.ai-run/guides/development/development-practices.md` |
| Architecture | `.ai-run/guides/architecture/architecture.md` |
| Data | `.ai-run/guides/data/database-patterns.md` |
| QA / quality gates / infra bounds | `.ai-run/guides/quality-gates.md` |
| Security | `.ai-run/guides/security/security-practices.md` |
| Delivery-local rules | `project-local` |

## One station adaptation

- **Station adapted:** [module / station]
- **Guide or slot used:** [path or name]
- **What transferred cleanly:** [bullets]
- **What required rewriting:** [bullets]

## Comparison with hand-wired run

| Question | Hand-wired run | Existing implementation |
|----------|----------------|-------------------------|
| Which seam became more visible? | | |
| Which human gate became more explicit? | | |
| Which risk changed? | | |
| What would be unsafe on a customer repository? | | |

## Recommendation

Choose one: **adopt**, **pilot**, or **defer**.

**Reason:** [one paragraph]
