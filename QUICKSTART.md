# Quickstart — Run Your AI Factory

Use this when you want the shortest path through the capstone. You do not need to build a new
platform. You copy this starter, add the role-agent specs you already produced, run one feature,
and record what broke at the seams.

## 0. What you need

- A sandbox repo where you can commit the factory run.
- The role-agent specs you produced in the role modules. These are your Final Kata outputs.
- Fallback specs from `fallback-specs/` for roles you did not complete.
- One small-to-medium feature from your running case.
- An approved agent runtime such as Claude Code, Cursor, Codex CLI, or a chat assistant you can use manually.

Do not paste secrets, client-confidential data, production credentials, or restricted customer data
into prompts, specs, or run artefacts. Use a representative case when the real one is restricted.

## 1. Copy the template

Copy the whole `factory-template/` directory into your sandbox repo.

Keep these paths:

- `CLAUDE.md` — the orchestrator.
- `AGENTS.md` — Codex guided-mode instructions.
- `.cursor/rules/ai-factory.mdc` — Cursor guided/manual mode instructions.
- `station-registry.yaml` — the station inventory.
- `handoff-map.yaml` — the explicit handoff graph.
- `factory-passport.md` — the run boundary and evidence checklist.
- `STATION_ADAPTER.md` — how to adapt a Final Kata Skill, sub-agent, or prompt.
- `PREFLIGHT.md` — checks before the first station call.
- `MANUAL_RUN_PROMPTS.md` — station-by-station manual prompts.
- `COST_GUARDRAILS.md` — model, pass, and stop boundaries.
- `station-slots/` — visible station wrappers; edit these first.
- `.claude/agents/` — Claude Code adapter files copied from adapted station slots.
- `fallback-specs/` — station specs you may copy when you do not have your own.
- `feature.md` — the feature you run.
- `runs/` — the run output folder.

## 2. Fill all ten station slots

For each role module you completed, adapt the matching file in `station-slots/` using
`STATION_ADAPTER.md`. Then copy it into `.claude/agents/` only if you run in Claude Code.

| Module | Visible station slot | Claude adapter if used |
|--------|----------------------|------------------------|
| 100 Consulting / SME | `station-slots/100-consulting.md` | `.claude/agents/100-consulting.md` |
| 200 Product / BA | `station-slots/200-product.md` | `.claude/agents/200-product.md` |
| 300 Design | `station-slots/300-design.md` | `.claude/agents/300-design.md` |
| 400 Architecture | `station-slots/400-architecture.md` | `.claude/agents/400-architecture.md` |
| 500 Engineering | `station-slots/500-engineering.md` | `.claude/agents/500-engineering.md` |
| 700 Data | `station-slots/700-data.md` | `.claude/agents/700-data.md` |
| 800 Infra/Ops | `station-slots/800-infrastructure.md` | `.claude/agents/800-infrastructure.md` |
| 900 Security | `station-slots/900-security.md` | `.claude/agents/900-security.md` |
| 600 QA | `station-slots/600-qa.md` | `.claude/agents/600-qa.md` |
| 1000 Management / Delivery | `station-slots/1000-delivery.md` | `.claude/agents/1000-delivery.md` |

For every role you did not complete, copy the matching file from `fallback-specs/` into
`station-slots/` and, for Claude Code, into `.claude/agents/`. A raw placeholder is an invalid
station slot for the required run.

Record the source option for every station: `own`, `own+overlay`, `fallback`, or
`fallback-after-gap`.

## 2.5 Pick a feature slug and a good first feature

Use lowercase words and hyphens: `cart-lookup`, `claim-upload-validation`,
`customer-merge-confidence`. Create `runs/<feature-slug>/`. Do not edit YAML files just to replace
`<feature-slug>`; it is a path placeholder.

Good first-run features touch at least 6 stations:

| Case | Feature | Why it works |
|------|---------|--------------|
| Meridian Retail | POS cart lookup | product, design, architecture, engineering, data, infra, security, QA, delivery |
| Meridian Retail | Loyalty points explanation | UX copy, policy, data lineage, security, tests, release readiness |
| Meridian Retail | Store pickup substitution recommendation | AI behavior, inventory data, fallback UX, safety review |
| Kepler Claims | Claims document upload validation | intake, data, validation, controls, QA evidence, rollout |
| Kepler Claims | Legacy app ownership discovery dashboard | architecture, data, governance, security, delivery planning |
| Kepler Claims | SOX audit trail for migration wave approval | compliance gate, data retention, release approval, security |
| Nordstar Data | Customer identity merge confidence report | data quality, lineage, privacy, review gates |
| Nordstar Data | Data-quality exception triage for Customer 360 | data contract, operational workflow, QA and delivery evidence |

## 3. Fill `feature.md`

Write one feature, not a full product. Use this shape:

```markdown
# Feature for the factory run

Store associates can retrieve a verified customer's online cart at the point of sale so the
customer can complete the purchase in store.

## Acceptance criteria

- [ ] The associate searches by verified customer identity.
- [ ] Cart items and stock status display in under 2 seconds.
- [ ] If identity or cart lookup fails, POS shows a fallback message and logs the event.
```

## 4. Run low-cost mode

Open the repo in your agent runtime and use this prompt:

```text
Run feature.md through the factory. Use low-cost mode: one pass per station, default or cheaper
approved model, no background teams, stop at invalid station slots, and record seam findings instead of
trying to hide them. Keep this to one small factory slice; do not turn it into an
enterprise-transformation plan.
```

The run should create `runs/<feature-slug>/` with:

- station output files such as `100-opportunity-brief.md` and `200-spec.md`;
- `transcript.md`;
- `seam-ledger.md`, `human-gates.md`, `eval-report.md`, `cost-log.md`, `risk-note.md`, and
  `final-recommendation.md`;
- a run record based on `runs/run-record.template.md`.

Stop and record a finding when a station:

- asks for context an upstream station should have supplied;
- tries to make a human-owned decision;
- asks for secrets, credentials, or client-confidential data;
- tries a live write to a production system;
- loops without producing its named output file;
- reaches a station that is still a placeholder or missing from the registry.

## 5. Manual mode fallback

If your runtime cannot dispatch between station files, run the same line by hand:

1. Open [`MANUAL_RUN_PROMPTS.md`](MANUAL_RUN_PROMPTS.md).
2. Open `feature.md`.
3. Open the first station file under `station-slots/` or `.claude/agents/`.
4. Paste the station prompt and input bundle into the approved chat.
5. Save the output under `runs/<feature-slug>/`.
6. Paste that saved output into the next station prompt.
7. Repeat until the line reaches Management / Delivery or an invalid station slot blocks the run.
8. Save your notes in `runs/<feature-slug>/transcript.md`.

Manual mode is not a weaker result. It often makes seams easier to see.

## 6. Read the seams

For each handoff, mark it:

| Mark | Use when |
|------|----------|
| clean | the downstream station got what it needed |
| under-supply | the upstream file missed something the downstream needed |
| over-supply | the upstream file carried more than the downstream could use |
| missing | no station owned the handoff |
| routing | work went to the wrong station |

Name the file and the two stations. For example: `200 Product / BA -> 300 Design,
runs/cart-lookup/200-spec.md, under-supply: no empty-state or accessibility requirement.`

## 7. Commit the run pack

Fill `runs/run-record.template.md`, save it as `runs/<feature-slug>/run-record.md`, and commit:

- `CLAUDE.md`;
- `station-registry.yaml`;
- `handoff-map.yaml`;
- `factory-passport.md`;
- `.claude/agents/`;
- `feature.md`;
- `runs/<feature-slug>/transcript.md`;
- every station output file;
- `runs/<feature-slug>/seam-ledger.md`;
- `runs/<feature-slug>/human-gates.md`;
- `runs/<feature-slug>/eval-report.md`;
- `runs/<feature-slug>/cost-log.md`;
- `runs/<feature-slug>/risk-note.md`;
- `runs/<feature-slug>/final-recommendation.md`;
- `runs/<feature-slug>/run-record.md`.

Your deliverable is not a flawless run. It is a runnable line plus the seam findings your team can
harden first.
