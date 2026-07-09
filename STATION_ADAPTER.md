# Station Adapter -- turn a Final Kata output into a 1111 station

## Rule

Your Final Kata output is the source spec. The station file is the Module 1111 wrapper that tells
the factory what this role reads, writes, and must not decide.

Two paths appear in this template:

- **Visible station slot:** `station-slots/<station>.md`. This is the learner-facing contract and
  the file you adapt first.
- **Runtime adapter:** `.claude/agents/<station>.md`. This is the Claude Code adapter copy. It is
  required only when you run the line with Claude Code auto-dispatch.

The wrapper does not change the role's expertise. It adds the contract the assembly line needs:

- exact station filename;
- exact upstream files to read;
- exact output file to write;
- human gates;
- done-when check;
- source status for the run record.

## Source options

Use one of these values in `factory-passport.md`, `runs/<feature-slug>/run-record.md`, and the
station file header.

| Source option | Use when |
|---------------|----------|
| `own` | Your Final Kata spec already covers the station contract and output file. |
| `own+overlay` | Your Final Kata spec is useful but narrower than the Module 1111 station contract; keep it and add the overlay below. |
| `fallback` | You did not complete that role module; copy the matching `fallback-specs/<station>.md`. |
| `fallback-after-gap` | You tried your own spec, found a scope gap during preflight or the run, and used the fallback so the line could continue. |

## If you produced a Skill

1. Open your `SKILL.md`.
2. Copy the instruction body into the matching file under `station-slots/`.
3. Keep the station overlay in that file.
4. Set `Station source` to `own` or `own+overlay`.
5. Copy the adapted station file into the runtime adapter you use:
   - Claude Code: `.claude/agents/<station>.md`
   - Codex guided mode: keep `station-slots/<station>.md` and use `AGENTS.md`
   - Cursor guided/manual mode: keep `station-slots/<station>.md` and use `.cursor/rules/ai-factory.mdc`
   - Approved chat manual mode: use `MANUAL_RUN_PROMPTS.md`

## If you produced a sub-agent

1. Copy the whole sub-agent file into the matching station slot.
2. Update `name`, `description`, `reads`, and `writes` to match the station contract.
3. Keep any useful role rules from your sub-agent.
4. Add the Module 1111 station overlay below if the original spec does not name the station output.

## If you only have a plain chat prompt

Paste it under `## Role rules` inside the matching station slot. Keep the station overlay. A plain
prompt can run the exercise if it reads and writes the right files and respects the human gates.

## Station mapping

| Module | Common Final Kata output | Visible station slot | Claude adapter |
|--------|--------------------------|----------------------|----------------|
| 100 | `.claude/skills/consulting-sme/SKILL.md` or `.claude/agents/consulting-sme.md` | `station-slots/100-consulting.md` | `.claude/agents/100-consulting.md` |
| 200 | `.claude/skills/pm-ba/SKILL.md` or `.claude/agents/pm-ba.md` | `station-slots/200-product.md` | `.claude/agents/200-product.md` |
| 300 | `.claude/skills/design/SKILL.md` or `.claude/agents/design.md` | `station-slots/300-design.md` | `.claude/agents/300-design.md` |
| 400 | `.claude/skills/architecture/SKILL.md` or `.claude/agents/architecture.md` | `station-slots/400-architecture.md` | `.claude/agents/400-architecture.md` |
| 500 | `.claude/skills/engineering/SKILL.md` or `.claude/agents/engineering.md` | `station-slots/500-engineering.md` | `.claude/agents/500-engineering.md` |
| 600 | `.claude/skills/qa/SKILL.md` or `.claude/agents/qa.md` | `station-slots/600-qa.md` | `.claude/agents/600-qa.md` |
| 700 | `.claude/skills/data/SKILL.md` or `.claude/agents/data.md` | `station-slots/700-data.md` | `.claude/agents/700-data.md` |
| 800 | `.claude/skills/ops/SKILL.md` or `.claude/agents/ops.md` | `station-slots/800-infrastructure.md` | `.claude/agents/800-infrastructure.md` |
| 900 | `.claude/skills/security/SKILL.md` or `.claude/agents/security.md` | `station-slots/900-security.md` | `.claude/agents/900-security.md` |
| 1000 | `.claude/skills/delivery-pm-status/SKILL.md` or `.claude/agents/delivery-pm.md` | `station-slots/1000-delivery.md` | `.claude/agents/1000-delivery.md` |

## Known narrow specs that usually need overlay

Some Final Kata specs are useful in their home module but too narrow for the assembly line. Use
`own+overlay` when the source spec is good but misses these Module 1111 reads or writes.

| Station | Common narrow source | Overlay usually needed |
|---------|----------------------|------------------------|
| 600 QA | A test-generation spec that reads only Product or Engineering output | Add Data, Infra/Ops, and Security reads before writing `600-test-plan.md`. |
| 700 Data | A data-quality or RAG-only spec | Add the Architecture read and require `700-data-design.md` as the station output. |
| 1000 Delivery | A status-report or project-plan spec | Make it read all prior station outputs plus optional `transcript.md`, then write `1000-release-plan.md`. |

## Station overlay template

Add this block to the adapted station file when your source spec does not already contain it.

```markdown
## Module 1111 station overlay

- **Visible station slot:** `station-slots/[station-file].md`
- **Claude adapter:** `.claude/agents/[station-file].md`
- **Role:** [role name]
- **Station source:** `own` / `own+overlay` / `fallback` / `fallback-after-gap`
- **Reads:** [exact input files]
- **Writes:** `runs/<feature-slug>/[output-file].md`
- **Station mode:** one pass, no background teams, no recursive calls, no live writes.
- **Human gates:** pause for [role decisions].
- **Fallback-gap instruction:** if this source spec cannot produce the named output from the named reads, record the gap and use the matching fallback spec.
- **Done when:** the output file exists and the next station can read it without new facts.
```

## Before you run

Run [`PREFLIGHT.md`](PREFLIGHT.md). If a station still starts with `INVALID PLACEHOLDER`, the line
must stop there until you replace it with `own`, `own+overlay`, `fallback`, or
`fallback-after-gap`.
