# Complexity Assessment — gdpr-directory-opt-out

**Routing**: writing-plans (score ~10 — small, focused, single feature area)

## Dimension Scores

| Dimension | Score | Notes |
|---|---|---|
| Files touched | 3 | 14 files but all in one cohesive feature area, all introduced in same run |
| Logic complexity | 2 | Filter + new parameter thread-through; no new algorithms |
| Test surface | 2 | ~6 new tests + ~20 call-site updates; all follow established patterns |
| Risk | 2 | Breaking internal change (compile-time caught); no external API break |
| Integration | 1 | No new services, no new endpoints, no new tables |
| Uncertainty | 1 | GDPR decisions just collected; design fully specified |

**Total**: ~11 → `writing-plans` routing

## Effort Estimate

- 1 SQL schema line
- ~60 lines of incremental C# changes spread across 8 source files
- ~25 test call-site updates + ~6 new test cases
- 1 commit per layer (schema → domain → application → api → tests)
