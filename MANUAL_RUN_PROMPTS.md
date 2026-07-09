# Manual Run Prompts

Use this file when your runtime cannot auto-dispatch station files. For each station, paste the
station instruction, paste the input bundle, ask for the named output, and save the result under
`runs/<feature-slug>/`.

Do not answer missing upstream questions with new facts. Stop or record a seam when a station asks
for missing upstream context. Continue only if the station can produce the named output using
documented assumptions.

## Shared prompt prefix

```text
You are running one station in the Module 1111 hand-wired AI factory.
Use one pass. Do not call background agents. Do not ask for secrets, credentials, production data,
or live system access. Read only the supplied input bundle. Write the named output file content.
If a human-owned decision is required, mark it as a human gate instead of deciding it.
If upstream context is missing, record the seam and continue only with a labelled training
assumption.
```

## Station 100 -- Consulting / SME

**Station file:** `station-slots/100-consulting.md` or `.claude/agents/100-consulting.md`

**Input bundle:**

- `feature.md`

**Ask:**

```text
Produce `runs/<feature-slug>/100-opportunity-brief.md`.
```

## Station 200 -- Product / BA

**Station file:** `station-slots/200-product.md` or `.claude/agents/200-product.md`

**Input bundle:**

- `runs/<feature-slug>/100-opportunity-brief.md`

**Ask:**

```text
Produce `runs/<feature-slug>/200-spec.md`.
```

## Station 300 -- Design

**Station file:** `station-slots/300-design.md` or `.claude/agents/300-design.md`

**Input bundle:**

- `runs/<feature-slug>/200-spec.md`

**Ask:**

```text
Produce `runs/<feature-slug>/300-design.md`.
```

## Station 400 -- Architecture

**Station file:** `station-slots/400-architecture.md` or `.claude/agents/400-architecture.md`

**Input bundle:**

- `runs/<feature-slug>/300-design.md`

**Ask:**

```text
Produce `runs/<feature-slug>/400-architecture.md`.
```

## Station 500 -- Engineering

**Station file:** `station-slots/500-engineering.md` or `.claude/agents/500-engineering.md`

**Input bundle:**

- `runs/<feature-slug>/400-architecture.md`

**Ask:**

```text
Produce `runs/<feature-slug>/500-implementation.md`.
```

## Station 700 -- Data

**Station file:** `station-slots/700-data.md` or `.claude/agents/700-data.md`

**Input bundle:**

- `runs/<feature-slug>/400-architecture.md`

**Ask:**

```text
Produce `runs/<feature-slug>/700-data-design.md`.
```

## Station 800 — Infra/Ops

**Station file:** `station-slots/800-infrastructure.md` or `.claude/agents/800-infrastructure.md`

**Input bundle:**

- `runs/<feature-slug>/400-architecture.md`
- `runs/<feature-slug>/500-implementation.md`
- `runs/<feature-slug>/700-data-design.md`

**Ask:**

```text
Produce `runs/<feature-slug>/800-infra.md`.
```

## Station 900 — Security

**Station file:** `station-slots/900-security.md` or `.claude/agents/900-security.md`

**Input bundle:**

- `runs/<feature-slug>/400-architecture.md`
- `runs/<feature-slug>/500-implementation.md`
- `runs/<feature-slug>/700-data-design.md`
- `runs/<feature-slug>/800-infra.md`

**Ask:**

```text
Produce `runs/<feature-slug>/900-security-review.md`.
```

## Station 600 — QA

**Station file:** `station-slots/600-qa.md` or `.claude/agents/600-qa.md`

**Input bundle:**

- `runs/<feature-slug>/200-spec.md`
- `runs/<feature-slug>/500-implementation.md`
- `runs/<feature-slug>/700-data-design.md`
- `runs/<feature-slug>/800-infra.md`
- `runs/<feature-slug>/900-security-review.md`

**Ask:**

```text
Produce `runs/<feature-slug>/600-test-plan.md`.
```

## Station 1000 -- Management / Delivery

**Station file:** `station-slots/1000-delivery.md` or `.claude/agents/1000-delivery.md`

**Input bundle:**

- `runs/<feature-slug>/100-opportunity-brief.md`
- `runs/<feature-slug>/200-spec.md`
- `runs/<feature-slug>/300-design.md`
- `runs/<feature-slug>/400-architecture.md`
- `runs/<feature-slug>/500-implementation.md`
- `runs/<feature-slug>/700-data-design.md`
- `runs/<feature-slug>/800-infra.md`
- `runs/<feature-slug>/900-security-review.md`
- `runs/<feature-slug>/600-test-plan.md`
- `runs/<feature-slug>/transcript.md` if it exists

**Ask:**

```text
Produce `runs/<feature-slug>/1000-release-plan.md`.
```
