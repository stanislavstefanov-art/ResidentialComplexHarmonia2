# Fallback Station Specs

Use these when you do not have a Final Kata spec for a role module or your source spec proves too
narrow for the Module 1111 station contract. Copy the matching file into `station-slots/` before the
run so all ten visible station slots are present. If you run Claude Code auto-dispatch, also copy
the adapted file into the matching `.claude/agents/` runtime adapter.

Fallback specs keep the capstone moving, but they are intentionally thin. Record every fallback you
use in `factory-passport.md`, the station header, and `runs/<feature-slug>/run-record.md`.

Canonical station order:

1. `100-consulting.md`
2. `200-product.md`
3. `300-design.md`
4. `400-architecture.md`
5. `500-engineering.md`
6. `700-data.md`
7. `800-infrastructure.md`
8. `900-security.md`
9. `600-qa.md`
10. `1000-delivery.md`
