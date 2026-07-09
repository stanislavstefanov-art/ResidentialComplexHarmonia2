# Claude station adapter

This folder is the Claude Code adapter for the visible station contract in `../../station-slots/`.
Edit `station-slots/` first, then copy the adapted file here when you run in Claude Code.

Use [`../../STATION_ADAPTER.md`](../../STATION_ADAPTER.md) to convert a Skill, sub-agent, or plain
chat prompt into the station wrapper. If you did not complete a role module, copy the matching
fallback spec from `../../fallback-specs/` into `../../station-slots/`, then copy the adapted slot
here when you run Claude Code. Record `fallback` in `factory-passport.md` and the run record.

| Station | File | Writes |
|---------|------|--------|
| 100 Consulting / SME | `100-consulting.md` | `runs/<feature-slug>/100-opportunity-brief.md` |
| 200 Product / BA | `200-product.md` | `runs/<feature-slug>/200-spec.md` |
| 300 Design | `300-design.md` | `runs/<feature-slug>/300-design.md` |
| 400 Architecture | `400-architecture.md` | `runs/<feature-slug>/400-architecture.md` |
| 500 Engineering | `500-engineering.md` | `runs/<feature-slug>/500-implementation.md` |
| 700 Data | `700-data.md` | `runs/<feature-slug>/700-data-design.md` |
| 800 Infra/Ops | `800-infrastructure.md` | `runs/<feature-slug>/800-infra.md` |
| 900 Security | `900-security.md` | `runs/<feature-slug>/900-security-review.md` |
| 600 QA | `600-qa.md` | `runs/<feature-slug>/600-test-plan.md` |
| 1000 Management / Delivery | `1000-delivery.md` | `runs/<feature-slug>/1000-release-plan.md` |

A station that still holds only its placeholder is **invalid** — the line stops there and you record
it as a registry finding. For the required run, all ten station slots must be present through either
your own spec, `own+overlay`, `fallback`, or `fallback-after-gap`.
