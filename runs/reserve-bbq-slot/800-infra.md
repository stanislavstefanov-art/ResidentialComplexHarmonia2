# Infra / Ops Design — Reserve the shared BBQ zone

**Station:** 800 Infra/Ops (source: `fallback`)
**Feature slug:** `reserve-bbq-slot`
**Reads:** `runs/reserve-bbq-slot/400-architecture.md`, `runs/reserve-bbq-slot/500-implementation.md`,
`runs/reserve-bbq-slot/700-data-design.md`
**Writes:** `runs/reserve-bbq-slot/800-infra.md`

## Purpose of this document

Give Security (900), QA (600), and Delivery (1000) a concrete, verifiable **operating shape** for the
one-app + one-store slice: where it runs, in which region, how it is configured, how it is observed,
how it is rolled back, what it costs, and which switches an operator pulls when something goes wrong.

This document does **not** re-open the concurrency decision (that is ADR-001 / GATE-ARCH-1), does
**not** finalise the schema (Station 700), does **not** accept the personal-data/retention policy
(GATE-DATA-1, Security-owned), and does **not** commit a release (Delivery 1000). It sizes and places
the runtime and hands verifiable operating facts downstream.

## Two load-bearing constraints this design must honour

1. **UC-1 atomicity is a disqualifying store criterion (architecture R1 / data 700).** The chosen
   store MUST enforce the exactly-one-holder invariant as a **single atomic operation** (unique
   constraint + conditional insert, or single-item conditional put). A store that can only do
   read-then-write is **disqualified** — no ops convenience overrides this.
2. **EU data residency for personal data.** `household_ref` (E1, E4) is EU personal data (data 700,
   architecture R4). The store **and its region and its backups** must sit in an **EU region**. The
   holder reference must be kept out of logs/telemetry.

Both are hard gates on the store/region choice below, ahead of cost or convenience.

---

## Deployment shape (proposed)

### Runtime target — SEAM: Station 500 did not fix a stack

Station 500 deliberately kept the stack **framework-neutral** ("Language/framework are not fixed by
architecture", 500 module map) and gave **no container image, manifest, or runtime target**. That is
correct scope discipline upstream, but it leaves Ops without a supplied deployment artefact. This is
surfaced as **SEAM-800-1 (under-supply)** below. Per handoff rules, I do **not** invent a full
deployment spec as if supplied; I proceed with an explicitly **labelled assumption (LA-800-1)** on the
*shape*, chosen to satisfy the two load-bearing constraints and the near-zero-budget / spiky-load
profile — the concrete image and manifest are produced once the stack is chosen (owner decision, G-INFRA-1).

**Proposed shape (LA-800-1 — shape only, not a committed stack):**

```
[ Resident phone (browser / PWA) ]
        |  HTTPS
        v
[ Managed edge / TLS termination ]            (platform-provided; no cert ops for us)
        |
        v
[ Stateless request handler ]                 <- the "single small app" (500), scale-to-zero
        |  single connection, server-derived householdRef only
        v
[ Managed datastore in an EU region ]         <- single source of truth; enforces UC-1 atomically
        |
        v
[ In-region automated backups ]               <- EU residency preserved for backups too
```

- **Single small app, stateless.** No session/lock/queue state held in the app (Option A puts the
  invariant in the store, 400/500), so the handler is horizontally trivial and can **scale to zero**
  between the rare spiky peaks. No in-memory hold state means a restart mid-request degrades only to
  `couldn't-confirm` (client re-reads, C5) — never to a lost or double hold.
- **Single managed datastore, one region.** One store holds E1/E2/E4 (700). Managed so there is no
  DB server for a no-ops building committee to patch.
- **No lock service, no queue, no cache treated as authoritative** (ADR-001/002) — keeps budget near
  zero and removes moving parts.

### Store shape — how it satisfies UC-1 + EU residency

Store product choice is a **human-owned decision (G-INFRA-1)** — near-zero budget and provider lock-in
are owner calls, not an agent's. Ops states the **required shape** and gives two qualifying families;
either is acceptable **only if it passes the UC-1 conformance test (RC-1) in-region**.

| Requirement | How the shape meets it |
|-------------|------------------------|
| **UC-1 atomic exactly-one-holder** | Store must natively support one of: (a) relational **unique/PK constraint + `INSERT ... ON CONFLICT DO NOTHING`** (data 700 Encoding R), or (b) single-item **conditional put `attribute_not_exists(slotId)`** (data 700 Encoding K). The store decides the race in one operation — no app read-then-write. |
| **EU residency** | Store region pinned to an **EU region** (e.g. an EU/eu-central/eu-west location); **backups and any replicas in-EU only**; no cross-region export of E1/E4. |
| **Near-zero budget / spiky load** | Prefer a **free-tier / scale-to-zero / serverless** managed store: a small managed serverless relational instance (Encoding R) or a pay-per-request managed KV/document table (Encoding K). No provisioned idle capacity billed 24/7. |
| **No-ops** | Managed backups, managed patching, in-region by configuration — no DB host to run. |

**Qualifying candidate families (illustrative, owner selects under G-INFRA-1 — not a committed vendor):**
- **Encoding R:** a small **managed serverless Postgres** in an EU region (PK/unique constraint gives
  UC-1 for free; scale-to-zero serverless tiers keep idle cost near zero).
- **Encoding K:** a **managed pay-per-request KV/document table** offered in an EU region, supporting
  a conditional put on item non-existence (per-request billing suits spiky/low volume).

Both satisfy UC-1 and EU residency; the pick is cost/lock-in/ops-familiarity — an owner call.

**Disqualified by policy:** any store without native atomic conditional write; any store with no EU
region; any tier that cannot keep backups in-EU; any "free" tier that pins data to a non-EU region.

---

## Environments

| Env | Purpose | Data | Region | Notes |
|-----|---------|------|--------|-------|
| **local / ephemeral** | Dev + the 500 test suite (unit/integration/concurrency) | Fake/ephemeral store; **no real personal data** | any (no PII) | 500 confirmed local verification needs no credentials, no live writes, no prod data. |
| **staging** | Pre-release verification: run RC-1 UC-1 conformance + AC-4 concurrency (T13/T14) against the **real chosen store in the EU region** | **Synthetic** `household_ref` tokens only; no real residents | **EU region** (same as prod) | Must mirror prod store/region so RC-1 proves the invariant on the real engine (500 F1: test against the real store, not only a fake). |
| **production** | Live single-building use | Real EU personal data (E1/E4) | **EU region** | Rollout is a **human gate** (GATE-REL-1). Access provisioning is owner-owned (G-INFRA-2). |

- **No shared store across envs.** Staging and prod use separate stores/tables so a staging test can
  never write into the production record (protects UC-1 truth and PII).
- **Environment access / provisioning** (who may deploy, who holds the cloud account) is a human-owned
  decision — **G-INFRA-2**. This run does not request or store any credentials, accounts, or secrets.

---

## Configuration

Config is environment-supplied, never baked into the image; **no secrets in this document**.

| Config key | Purpose | Where set | Sensitive? |
|-----------|---------|-----------|:---:|
| `STORE_ENDPOINT` / connection target | Point app at the in-region store | Env / platform config | Endpoint no; credential yes (secret manager) |
| `STORE_REGION` | Pin the EU region (residency guard) | Env / platform config | No — but **asserted at startup** |
| `SLOT_GRID_CONFIG` source | Where SlotGridConfig (E2) is read (G1 values) | Store/config; owner supplies values | No |
| `SESSION_VERIFIER` target | Upstream identity/session validation (G3/D1, consumed) | Env / platform config | Credential yes (secret manager) |
| `RETENTION_HOLDS_DAYS` / `RETENTION_AUDIT_DAYS` | Purge windows (proposed 30d / 90d) | Env — **pending GATE-DATA-1** | No |
| `LOG_LEVEL` | Observability verbosity | Env | No |

- **Secrets** (store credential, session-verifier credential) live in the platform's secret manager,
  **never** in code, logs, or this file. This run neither requests nor stores any secret value.
- **Residency self-check:** the app **asserts `STORE_REGION` is an allowed EU region at startup** and
  refuses to boot otherwise — a cheap guard so a misconfigured non-EU store cannot silently take PII.
- Retention config defaults are the **proposed** 30d/90d from data 700 and are **not policy** until
  GATE-DATA-1 is signed off.

---

## Observability

Log the **outcome, never the holder** (data 700 R4 / DQ-4). `household_ref` MUST NOT appear in logs,
traces, error messages, or metrics labels.

**Structured events (PII-free):**
- Per reserve attempt: `{ event: "claim", outcome, day_date, slot_key, latency_ms, store_result }` —
  `outcome ∈ confirmed-yours | refused-already-taken | couldn't-confirm`. **No `household_ref`.**
- Per read: `{ event: "read_day", day_date, slot_count, latency_ms }`.
- App lifecycle: startup (incl. **residency self-check pass/fail**), store connect/disconnect.

**Metrics (counters/gauges, PII-free labels only):**

| Metric | Why it matters |
|--------|----------------|
| `reserve_outcome_total{outcome}` | Split of yours / already-taken / couldn't-confirm. |
| `couldnt_confirm_rate` | Store health / flaky path — the key reliability signal. |
| `reserve_latency_p95` | Confirm/renegotiate the LA-ARCH-1 proposed **p95 ≤ ~1s** budget. |
| `store_conditional_write_errors_total` | Distinguishes real store failure from normal refusals. |
| `app_availability` (up/down) | Business-hours best-effort target (LA-ARCH-1). |
| `residency_check_failed_total` | MUST stay 0 — any nonzero is a residency incident. |

**Audit (from data 700 E4):** ClaimAuditEvent is emitted per attempt and is the QA/Security evidence
trail for AC-4/AC-5/NFR-4 and dispute resolution. Audit carries `household_ref`, is PII-classified,
lives in-EU, and is subject to the E4 retention (GATE-DATA-1). Audit is a **datastore record**, not a
log line — the R4 "no holder in logs" rule still holds.

## Alerts

Sized for a small single building, low/spiky volume — favour a few high-signal alerts over noise.

| Alert | Condition | Severity | First responder |
|-------|-----------|----------|-----------------|
| **A1 Store unreachable** | `couldnt_confirm_rate` high OR store connect failing | High | Ops on-call (role) |
| **A2 Residency breach** | `residency_check_failed_total` > 0 OR startup residency self-check fails | **Critical** | Ops on-call + Data Protection owner (role) |
| **A3 Latency breach** | `reserve_latency_p95` > agreed budget for a sustained window | Medium | Ops on-call (role) |
| **A4 Possible invariant break** | DQ-1 (duplicate `slotId`) check finds any row/item | **Critical** | Ops on-call + Engineering (role) |
| **A5 PII-in-logs** | Log-scan detects a `household_ref`-shaped value (DQ-4) | High | Ops on-call + Data Protection owner (role) |
| **A6 App down** | `app_availability` down during business hours | Medium | Ops on-call (role) |

All responder names are **role placeholders**; no real personnel data is requested or stored.

---

## L1 / L2 Runbook

**L1 = first responder (contain / triage, no code change). L2 = engineering escalation (diagnose /
fix).** Owners are role placeholders.

### L1 — containment & triage

| Symptom / alert | L1 action | Escalate to L2 when |
|-----------------|-----------|---------------------|
| **A1 Store unreachable** | Confirm store health in provider console; verify `STORE_ENDPOINT`/region config unchanged; app keeps returning honest `couldn't-confirm` (no fake success), so no data risk. | Store healthy but errors persist, or outage > agreed window. |
| **A2 Residency breach** | **Pull KS-2 (residency kill switch): stop writes / take app offline immediately.** Personal data must not land outside EU. Notify Data Protection owner. | Always — residency is Critical; L2 + Data Protection owner engage at once. |
| **A3 Latency breach** | Check store tier throttling / cold-start; confirm no traffic spike beyond single-building profile. | Latency sustained after cold-start warm-up. |
| **A4 Duplicate slotId (invariant)** | **Pull KS-1 (reserve kill switch): disable the reserve surface** (reads may stay up). A double-book means UC-1 may not be holding — stop making it worse. Preserve E4 audit. | Always — Critical; L2 + Engineering investigate whether the store lost atomicity (R1). |
| **A5 PII-in-logs** | Rotate/scrub affected log sink per platform; stop the offending log emission (raise `LOG_LEVEL` if needed). | Always — Engineering fixes the log statement; Data Protection owner assesses exposure. |
| **A6 App down** | Restart via platform (stateless — safe to restart; no hold state lost). Scale-to-zero cold start is expected, not an outage. | Restart does not recover, or crash-loops. |

### L2 — diagnose & fix

| Escalation | L2 diagnosis path | Fix / recovery |
|-----------|-------------------|----------------|
| Store unreachable (A1) | Provider status, connection limits, region availability. | Fail to honest degraded mode (all `couldn't-confirm`); if store data intact, no restore needed — no fake writes occurred. |
| Residency breach (A2) | Determine what data (E1/E4) may have left EU and how config drifted. | Correct `STORE_REGION`/endpoint to EU; purge any non-EU copy; **rollback** to last EU-correct deploy; report to Data Protection owner. |
| Invariant break (A4) | Reproduce RC-1 / T13-T14 against the **real store**; confirm whether the store's conditional write is genuinely atomic (R1/F1). | If store lost atomicity, **KS-1 stays engaged** and store choice is re-opened (G-INFRA-1) — a store that cannot hold UC-1 is disqualified even in prod. Reconcile duplicates via E4 audit (`claimed_at` earliest wins, human-adjudicated). |
| PII-in-logs (A5) | Locate the log/trace statement leaking `household_ref`. | Remove field, add/repair the DQ-4 log-scan guard, redeploy. |
| Retry false-refusal (R2) | Check IC-1 idempotency path (holder==me ⇒ confirmed). | Fix mapping so a household's own re-submit returns `confirmed-yours`. |

**Recovery ordering principle:** honest failure (`couldn't-confirm`) is always preferred over a fake
success or a risked double-book. When in doubt, L1 pulls the relevant kill switch and the system tells
residents the truth via re-read (DA3/C5).

---

## Kill switches (4) — named role owners

Kill switches are **operator-flippable feature/traffic controls**, not code deploys, so containment is
fast. Each has a role-placeholder owner. No secrets/credentials involved.

| ID | Kill switch | Effect | Trips (auto/manual) | Owner (role) |
|----|-------------|--------|---------------------|--------------|
| **KS-1** | **Reserve disable** | Turns off the reserve/claim surface; **reads stay up** (residents can still see the day, just cannot claim). | Manual on A4 (invariant) / suspected UC-1 loss | Ops on-call (role) |
| **KS-2** | **Residency stop / offline** | Halts all writes / takes app offline to stop PII landing outside EU. | Auto on residency self-check fail at startup; manual on A2 | Data Protection owner (role) |
| **KS-3** | **Read-only mode** | Whole feature read-only (no writes to E1/E4) for store maintenance or suspected data-integrity work, without a full outage. | Manual (maintenance / A1 severe) | Ops on-call (role) |
| **KS-4** | **Full feature disable** | Both surfaces off; feature returns a maintenance response. Last resort. | Manual — any Critical not contained by KS-1/KS-2/KS-3 | Delivery owner (role) |

**Kill-switch count: 4** (KS-1 reserve-disable, KS-2 residency-stop, KS-3 read-only, KS-4 full-disable).

Design note: KS-1 and KS-3 exploit the stateless / store-owns-truth shape — disabling writes cannot
corrupt or lose a hold, because no hold state lives in the app. KS-2 is deliberately owned by the Data
Protection role, not generic Ops, because a residency event is a personal-data event first.

---

## Rollback

- **App rollback:** the handler is **stateless**, so rollback = redeploy the previous version /
  shift traffic back. No hold state migrates; in-flight requests degrade to `couldn't-confirm`
  (client re-reads). Safe and fast.
- **Store rollback:** the store is the source of truth and is **not** rolled back casually — restoring
  a backup would resurrect stale holds. For a data-integrity incident, prefer **forward fix +
  reconcile from E4 audit** over a blind restore. In-EU backups exist for disaster recovery only, and
  any restore stays in-EU.
- **Config rollback:** revert env/config (esp. `STORE_REGION`) to the last known EU-correct value; the
  startup residency self-check blocks a bad region from booting.
- **Schema/migration:** none in this slice beyond initial create (data 700 has no release/free
  transition; G2 out of scope). If G2 reopens, migrations get their own rollback plan then.

---

## Capacity & cost guardrails

Profile: **single small building, low/spiky** (a popular Saturday slot is the peak). This is a
handful of residents, not fleet scale.

| Guardrail | Target | Basis |
|-----------|--------|-------|
| Compute | **Scale-to-zero** app; no provisioned idle instances | Near-zero budget; spiky (400/LA-ARCH-1) |
| Store | Free-tier / serverless / pay-per-request; **no 24/7 provisioned capacity** | Near-zero budget |
| Latency | Confirm/renegotiate **p95 reserve ≤ ~1s** (LA-ARCH-1 proposed, not committed) | Ops confirms in staging |
| Availability | **Business-hours best-effort**, single-region, no HA/multi-region | LA-ARCH-1; near-zero budget |
| Backups | In-EU automated managed backups; DR-only restore | EU residency + no-ops |
| **Cost ceiling** | **Owner-approved budget cap — GATE-BUDGET-1** | Budget is human-owned |

**Cost note:** the chosen shape (scale-to-zero app + serverless/pay-per-request in-EU store, no lock
service/queue/cache) is designed to sit near a free tier at this volume. A hard spend cap and any paid
tier are an **owner budget decision (GATE-BUDGET-1)** — not accepted here.

---

## Release checklist (hand to Delivery 1000)

Pre-release gates Delivery must see green before GATE-REL-1 production rollout:

- [ ] **RC-1 (UC-1 conformance):** the atomic conditional-write / unique-constraint is proven on the
      **real chosen store in the EU region** (not only a fake) — data 700 store-selection gate / 500 F1.
- [ ] **RC-2 (AC-4 concurrency):** 500 tests **T13/T14** pass against the staging real store — two
      simultaneous claims → exactly one `confirmed-yours`, one `refused-already-taken`, one holder.
- [ ] **RC-3 (EU residency):** store region, replicas, and backups confirmed **in-EU**; startup
      residency self-check verified; `residency_check_failed_total == 0`.
- [ ] **RC-4 (PII-out-of-logs):** DQ-4 log-scan finds no `household_ref` in logs/traces (T16).
- [ ] **RC-5 (idempotency):** IC-1 / R2 retry path returns `confirmed-yours` for holder==me (T15).
- [ ] **RC-6 (observability live):** metrics + alerts A1–A6 wired; audit (E4) recording.
- [ ] **RC-7 (kill switches):** KS-1..KS-4 exist and are exercised with role owners assigned.
- [ ] **RC-8 (rollback rehearsed):** stateless app rollback + config revert verified in staging.
- [ ] **RC-9 (config/secrets):** secrets in secret manager; no PII/secrets in image, logs, or repo.
- [ ] **RC-10 (G1 grid fixed):** owner has fixed the concrete slot grid so `slot_key` granularity is
      correct (R5) — UC-1 guards the right unit.
- [ ] **Human gates cleared:** GATE-ARCH-1, GATE-DATA-1, GATE-BUDGET-1, G-INFRA-1, G-INFRA-2,
      GATE-REL-1 signed off by their owners.

---

## Seam / under-supply findings

- **SEAM-800-1 (under-supply — Station 500 deployment detail):** the implementation plan supplies no
  container image, manifest, or concrete runtime target (framework-neutral by design). Ops therefore
  cannot emit a real deployment artefact and proceeds on the **shape-only** assumption **LA-800-1**.
  This is not a defect in 500 (correct scope discipline), but the concrete stack + manifest is an open
  owner decision **G-INFRA-1**; a real deployment cannot be produced until the stack is chosen. Not
  fabricated here.
- **Dependency carried (not new): F1 / R1** — the whole operating shape rests on the store genuinely
  enforcing UC-1 atomically. Ops makes this a **disqualifying store-selection criterion** and puts it
  in the release checklist (RC-1) and the invariant-break runbook (A4/KS-1). Not accepted here; owned
  upstream (Data 700) and by QA (600) to test against the real store.

---

## Open questions / human gates

- **GATE-BUDGET-1 (budget cap / paid tier — `hard-stop` for real spend, `training-open` for the run):**
  a spend ceiling and any move off free tier are **owner-owned**. The run may continue on the near-zero
  free-tier assumption; committing real budget requires owner approval.
- **G-INFRA-1 (store product + provider/region selection — `training-open`, needs owner):** Ops states
  the required **shape** (UC-1-atomic + EU region + scale-to-zero) and qualifying families; the concrete
  vendor/product/region and lock-in are an owner decision. Any candidate must pass RC-1 in-EU.
- **G-INFRA-2 (environment access / provisioning — `hard-stop`, owner-owned):** who holds the cloud
  account and who may deploy to staging/prod. This run requests/stores **no** credentials, accounts, or
  secrets and makes **no** live writes.
- **GATE-REL-1 (production rollout / SLO acceptance — `hard-stop`, Delivery-owned):** going live and
  accepting the proposed latency/availability budgets (LA-ARCH-1) is a human release commitment, not an
  agent decision. Release checklist above must be green first.
- **GATE-DATA-1 carried forward (residency/retention/classification — `training-open`, Data/Security
  owner):** `household_ref` EU-personal-data classification and the proposed 30d/90d retention are
  **not policy** until a data/security owner confirms. Ops implements them as config
  (`RETENTION_*_DAYS`) but does not accept the policy. Blocks production-like use until signed off.
- **GATE-ARCH-1 carried forward (concurrency mechanism — `training-open`, owner):** the entire infra
  shape assumes Option A (store-level atomic conditional claim). Not sign-off; a real release needs
  ADR-001 confirmed.
- **G1 carried forward (slot grid — `recorded-open`, upstream owner):** concrete grid fixes `slot_key`
  granularity (R5); must be set before release (RC-10).
- **G2 carried forward (cancellation/release — `recorded-open`, do not design):** no free-slot
  transition exists; store shape needs claim only. If reopened, a concurrency-safe release + its own
  rollback/runbook are needed. Flagged, not built.
- **G3 / D1 carried forward (identity source — `recorded-open`, upstream owner):** upstream session
  supplies `isResident` + `householdRef`; consumed via `SESSION_VERIFIER`, not built here.

## Labelled assumptions made by Infra/Ops

- **LA-800-1 (deployment shape, not stack):** because Station 500 fixed no runtime target
  (SEAM-800-1), Ops assumes a stateless scale-to-zero handler + single managed in-EU store as the
  **shape**; the concrete image/manifest/vendor await G-INFRA-1. Not a supplied deployment spec.
- **LA-800-2 (near-zero via free tier):** the shape is assumed to sit at/near a free/serverless tier
  for single-building volume; a real spend cap and any paid tier are GATE-BUDGET-1.
- **LA-800-3 (proposed NFR budgets carried):** the p95 ≤ ~1s latency and business-hours best-effort
  availability are the architecture's **proposed** budgets (LA-ARCH-1), confirmed in staging and
  formally accepted only at GATE-REL-1 — not committed SLAs.
- **LA-800-4 (retention config = proposal):** `RETENTION_HOLDS_DAYS=30` / `RETENTION_AUDIT_DAYS=90`
  are wired as config from data 700 proposals; they are **not** policy until GATE-DATA-1.

## Done-when check

Security (900) can see: EU-region single store, holder-ref kept out of logs (R4/DQ-4), residency
startup self-check, secrets in a secret manager, and the residency kill switch KS-2 — enough to verify
the personal-data operating shape. QA (600) can see: the RC-1/RC-2 real-store concurrency + UC-1
conformance gates, DQ checks wired to alerts, and audit (E4) as evidence. Delivery (1000) can see: the
release checklist, four kill switches with role owners, rollback plan, cost guardrails, and every open
human gate needed to plan release readiness.
