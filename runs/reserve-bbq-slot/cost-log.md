# Cost Log -- reserve-bbq-slot

Model/cost note: each station ran as one Claude Code subagent dispatch on the **inherited default model** (no premium/reasoning model invoked, no model override on any `ai-run-*` agent). Token figures below are the subagent token counts reported by the runtime; they are usage indicators, not a billed cost.

| Station | Status | Runtime | Model | Passes | Cost/token note | Premium reason |
|---------|--------|---------|-------|--------|-----------------|----------------|
| 100 | ran | Claude Code (subagent) | default (inherited) | 1 | ~7,965 tok · 35s · 3 tool uses | — none |
| 200 | ran | Claude Code (subagent) | default (inherited) | 1 | ~12,023 tok · 74s · 3 tool uses | — none |
| 300 | ran | Claude Code (subagent) | default (inherited) | 1 | ~15,956 tok · 101s · 3 tool uses | — none |
| 400 | ran | Claude Code (subagent) | default (inherited) | 1 | ~24,462 tok · 139s · 4 tool uses | — none |
| 500 | ran | Claude Code (subagent) | default (inherited) | 1 | ~22,386 tok · 129s · 3 tool uses | — none |
| 700 | ran | Claude Code (subagent) | default (inherited) | 1 | ~21,643 tok · 122s · 3 tool uses | — none |
| 800 | ran | Claude Code (subagent) | default (inherited) | 1 | ~40,872 tok · 175s · 5 tool uses | — none |
| 900 | ran | Claude Code (subagent) | default (inherited) | 1 | ~52,679 tok · 176s · 6 tool uses | — none |
| 600 | ran | Claude Code (subagent) | default (inherited) | 1 | ~60,954 tok · 164s · 7 tool uses | — none |
| 1000 | ran | Claude Code (subagent) | default (inherited) | 1 | ~88,076 tok · 143s · 12 tool uses | — none |

**Totals:** 10 station calls · ~347,000 subagent tokens · one pass per station · no premium model.

**Run boundary check:** one feature, one pass per station, no background teams, no parallel autonomous workers, no recursive station calls, no enterprise-transformation planning. ✅ held.

**Stop rule:** stop after 10 station calls or the first hard stop. Result: 10 station calls, no hard stop tripped during the run. ✅ within bound.

**Premium model max:** one named human-reviewed decision. Used: **zero** — no premium model was invoked at any station.
