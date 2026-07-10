# Security Review — Reserve the shared BBQ zone

**Station:** 900 Security (source: `fallback`)
**Feature slug:** `reserve-bbq-slot`
**Reads:** `runs/reserve-bbq-slot/400-architecture.md`, `runs/reserve-bbq-slot/500-implementation.md`,
`runs/reserve-bbq-slot/700-data-design.md`, `runs/reserve-bbq-slot/800-infra.md`
**Writes:** `runs/reserve-bbq-slot/900-security-review.md`

## Purpose and scope

Rate the security of the one-app + one-store slice: a signed-in resident views a day's BBQ slots
and atomically claims a free one, with exactly one winner (Option A / ADR-001). This review builds a
threat model (classical + relevant OWASP), rates each finding, states residual-risk contracts, and
carries forward the open human gates. Every finding names a **check** so Station 600 (QA) can turn it
into a test case.

This review does **not** rewrite architecture/data/infra — it raises findings *against* those inputs.
It does **not** self-accept any risk: accepting a residual risk without a named human owner is a human
gate (recorded, not signed off here). It does **not** design the identity source (G3/D1), the store
product (G-INFRA-1), or release (GATE-REL-1).

Design premise inherited (confirmed sound from a security view): the server owns the truth, the client
never decides success (DA3/ADR-003), and the invariant lives inside the store (Option A). This premise
eliminates several classical client-trust attacks *by construction* — noted per finding where it does.

---

## 1. Trust boundaries

```
 [ UNTRUSTED ]  Resident phone (browser / PWA), public internet
        |  TB-1: HTTPS + upstream session token
        v
 [ SEMI-TRUSTED / consumed, not built ]  Identity / sign-in gate (G3/D1)  ← the AC-6 root of trust
        |  TB-2: asserts { isResident, householdRef } to the app
        v
 [ TRUSTED slice — this build ]  Reserve app (read surface + reserve surface)
        |  TB-3: single connection, server-derived householdRef only
        v
 [ TRUSTED datastore, EU region ]  E1 Slot / E2 grid / E4 audit — source of truth (UC-1)
        |  TB-4: in-EU automated backups
        v
 [ in-EU backup ]
```

| TB | Boundary | What crosses it | Security control at the boundary |
|----|----------|-----------------|----------------------------------|
| **TB-1** | Phone ↔ app (public internet) | HTTP request + session token; `day`, `slotKey` (path); **no holder in body** (ADR-005) | HTTPS/TLS (managed edge, 800); server re-checks residency every request (ADR-005); input validation (500 validation table) |
| **TB-2** | Identity gate ↔ app | `{ isResident, householdRef }` from the resolved session | **The AC-6 root of trust.** App trusts this assertion but does not build it (G3/D1). If this assertion can be forged/replayed, AC-6 collapses — see F1. |
| **TB-3** | App ↔ store | slotId + server-derived householdRef; atomic conditional write | householdRef derived server-side only (never from client); single connection; secrets in secret manager (800) |
| **TB-4** | Store ↔ backups / any replica | E1/E4 records containing `household_ref` (PII) | Backups + replicas **in-EU only** (800); residency startup self-check (KS-2) |

**The load-bearing trust boundary is TB-2.** AC-6 ("only a signed-in resident may view/reserve") is
only as strong as the upstream session assertion. This slice *consumes* that assertion; it does not
verify how it is minted. That dependency is the single most important open security item (F1).

---

## 2. Sensitive data inventory

| Data | Where | Classification (proposed, GATE-DATA-1) | Security consequence |
|------|-------|----------------------------------------|----------------------|
| `household_ref` (E1, E3, E4) | Slot hold, audit, referenced from identity | **EU personal data — indirect identifier** | Minimise, keep out of logs (R4/DQ-4), EU-resident, restrict permitted use |
| `household_ref` + `day_date` + `slot_key` (linked) | E1, E4 | **EU personal data — behavioural** | Reveals which household is where/when; must be protected as PII wherever the three appear together |
| Session token / verifier credential | TB-1/TB-2 config | **Secret** | Secret manager only; never in code/logs/repo (800 RC-9) |
| Store connection credential | TB-3 config | **Secret** | Secret manager only |
| Upstream name / apartment / contact | Upstream (G3/D1) | **EU personal data — direct identifiers** | **Not stored in this slice** (data minimisation, LA-DATA-2); boundary awareness only |
| `day_date`, `slot_key`, `outcome`, `claimed_at`, grid labels | E1/E2/E4, logs, metrics | Non-personal / operational | Safe to log (this is what logs/metrics carry instead of the holder) |

Data-minimisation posture is **good**: the slice stores only an opaque `household_ref`, never direct
identifiers. This materially shrinks the breach blast radius and is the correct EU posture. Confirmed,
not a finding.

---

## 3. Threat model (classical STRIDE + relevant OWASP), with ratings

Rating scale: **Critical / High / Medium / Low**, judged on (likelihood at this single-building,
low/spiky scale) × (impact: personal-data exposure, invariant integrity, or trust). Each finding names
the **check** handed to QA (600). "Owned upstream" means the mitigation exists in an input and I am
raising it as a testable/verifiable dependency, not a new defect.

### 3.1 Spoofing / broken access control — the residents-only boundary (AC-6)
OWASP: **A01 Broken Access Control**, **A07 Identification & Authentication Failures**.

| ID | Threat | Rating | Mitigation (owner) | Check for QA (600) |
|----|--------|:------:|--------------------|--------------------|
| **F1** | **Forged/replayed/expired session accepted as a resident.** The app trusts the upstream `{ isResident, householdRef }` (TB-2) but does not verify how the session is minted/validated (G3/D1 unproven). A forged, replayed, or stale token could let a non-resident view or claim, or let one household act as another. | **High** | Residency re-checked server-side each request (ADR-005) — but the *strength* of the check depends on the upstream verifier (G3/D1), which is **not proven** in these inputs. Session validation (`SESSION_VERIFIER`, 800) is consumed, not built. **Not self-accepted — see Gate G3/D1 hardened below.** | **SEC-CHK-1:** with an absent/invalid/expired/tampered session token, both `GET` and `POST` return refused (401/403), no slot data, no record created, no audit `confirmed`. **SEC-CHK-1b:** a session for household A cannot cause a hold attributed to household B (token-substitution / replay test against the real verifier). |
| **F2** | **Non-resident reaches read or reserve surface** (authenticated but not a resident, or unauthenticated). | **High→Medium** (mechanism present) | Residency gate `requireResident` refuses on both surfaces before any data/claim (500 pseudocode; T8). Non-resident → refused, no record. | **SEC-CHK-2** (= T8 extended): non-resident and unauthenticated callers refused on **both** surfaces; assert no `household_ref` written and no audit `confirmed` emitted. |
| **F3** | **Client spoofs another household as holder** by supplying a household field in the request body. | **Low** (closed by design) | `household_ref` is derived server-side from the resolved session; body household fields are ignored/rejected (ADR-005; T9). | **SEC-CHK-3** (= T9): a `POST` carrying a forged `householdRef`/holder field in the body is ignored; the hold is attributed to the session's household only. |
| **F4** | **IDOR / horizontal access** — a resident enumerates or reads another household's holds beyond the intended free/taken-mine/taken-other states. | **Low** | Read surface derives only `free / taken-mine / taken-other`; `taken-other` deliberately does **not** reveal *which* household holds it (500 deriveState). No holder identity is returned to the client. | **SEC-CHK-4:** read response for a slot held by another household returns `taken-other` **only** — no `household_ref`, name, or apartment leaked in the payload. |

### 3.2 Tampering / integrity — the no-double-booking invariant (AC-4 / NFR-1 / NFR-4)
OWASP: **A04 Insecure Design**, **A08 Software & Data Integrity Failures**. This is the load-bearing
integrity property; I attacked it three ways — bypass, race, forge.

| ID | Threat | Rating | Mitigation (owner) | Check for QA (600) |
|----|--------|:------:|--------------------|--------------------|
| **F5** | **Race bypass (TOCTOU).** Two simultaneous claims both read "free" then both write → double-book. | **Low** (closed by design **iff** F6 holds) | The winner is decided by a **single atomic conditional write inside the store** (Option A); there is **no app-layer read-then-write on the write path** (500 §3/§4). The refusal-path read (me vs other) is off the winner-decision path. The exact class of bug that plagues booking systems is eliminated by construction. | **SEC-CHK-5** (= T13/T14, security-lens): fire two simultaneous claims on one free slot → exactly one `confirmed-yours`, one `refused-already-taken`, exactly one holder record, existing hold untouched. Add an **adversarial burst** (N≫2 simultaneous claims) to probe for any window. |
| **F6** | **Silent integrity failure: store does not truly enforce atomic conditional write.** If the selected store (G-INFRA-1) only supports read-then-write, UC-1 degrades to best-effort and F5 reopens invisibly. This is architecture R1 / engineering F1. | **High** (integrity-critical dependency) | ADR-001 makes atomic-claim support a **disqualifying** store-selection criterion; Data 700 store-selection gate; Ops RC-1 requires proving it **on the real chosen store in the EU region**, not only a fake. **Not accepted here — it is an unresolved dependency riding on G-INFRA-1.** | **SEC-CHK-6** (= RC-1 / DQ-1, security-lens): run the concurrency proof (SEC-CHK-5) against the **real chosen store in-region**; assert DQ-1 (no two records share a `slotId`) is empty. A store that fails this is disqualified even in prod (800 A4/KS-1). |
| **F7** | **Refused attempt mutates or steals the existing hold** (integrity of the loser path). | **Low** (closed by design) | On refusal the app performs **no** mutation — the conditional write already failed; only a classifying read runs (500 §3; IC-1). Existing holder provably untouched (AC-5/NFR-4). | **SEC-CHK-7** (= T12): a losing/second claim leaves the original `household_ref` and `claimed_at` byte-for-byte unchanged; audit shows `refused-already-taken`, not a mutation. |
| **F8** | **Idempotency abused to overwrite** — a crafted retry causes "holder==me" logic to overwrite another household's hold. | **Low** | IC-1 is a **read-after-reject**, never a second write; `holder==me ⇒ confirmed`, `holder==other ⇒ refused` (700 IC-1; 500 T6/T15). It cannot write over an existing hold. | **SEC-CHK-8** (= T15 + adversarial): a retry where the current holder is a *different* household returns `refused-already-taken` (never `confirmed-yours`); confirm no write occurs on the idempotent path. |
| **F9** | **Audit tampering / repudiation.** A resident disputes "who holds Saturday"; audit could be altered to change the record. | **Medium** | E4 ClaimAuditEvent is append-only, no update/delete before retention expiry (700 AUDIT-APPEND / DQ-5). Provides tamper-evident dispute evidence. | **SEC-CHK-9** (= DQ-5): attempt update/delete of an E4 record before retention expiry is rejected; every claim attempt produces exactly one immutable audit event. |

### 3.3 Information disclosure — EU personal data (`household_ref`) — GATE-DATA-1
OWASP: **A02 Cryptographic/Sensitive Data Exposure**, **A09 Security Logging & Monitoring Failures**.

| ID | Threat | Rating | Mitigation (owner) | Check for QA (600) |
|----|--------|:------:|--------------------|--------------------|
| **F10** | **`household_ref` leaks into logs / traces / errors / metrics labels** → PII exposure, possibly to a non-EU log sink. | **High** | Log outcome, never holder (R4/DQ-4); metrics labels PII-free (800 observability); log-scan guard + lint rule "no householdRef in log statements" (500 T16). Alert A5 + KS scrub path (800). | **SEC-CHK-10** (= T16/DQ-4): across claim, refusal, idempotent retry, error, and timeout paths, assert `household_ref` appears in **no** log line, trace, error message, or metric label. Include a log-sink scan for holder-shaped values. |
| **F11** | **PII (E1/E4 + backups) resides or is exported outside the EU** → residency breach. | **High** | Store, replicas, and backups pinned in-EU (800); **startup residency self-check refuses to boot on non-EU region**; metric `residency_check_failed_total` must stay 0; Critical alert A2 + KS-2 residency kill switch owned by Data Protection role. | **SEC-CHK-11:** startup with a non-EU `STORE_REGION` **fails to boot** (self-check); `residency_check_failed_total == 0` in staging/prod; verify no cross-region export path for E1/E4 (backups enumerated as in-EU). |
| **F12** | **Over-retention / permitted-use creep** — holder data kept past need, or used for profiling/marketing/sharing (secondary use) without authorisation. | **Medium** | Proposed retention 30d holds / 90d audit (700); permitted use limited to (a) render own slots, (b) enforce invariant, (c) dispute audit — anything else out of scope (700). **These are proposals, NOT policy until GATE-DATA-1 is signed off.** Purge windows wired as config `RETENTION_*_DAYS` (800). **Not accepted here.** | **SEC-CHK-12:** once GATE-DATA-1 fixes the windows, verify holds past `day_date + RETENTION_HOLDS_DAYS` and audit past `RETENTION_AUDIT_DAYS` are purged; assert no code path uses `household_ref` for anything beyond the three permitted uses. |
| **F13** | **Subject-rights gap (GDPR access/erasure).** As EU personal data, `household_ref` records may be subject to data-subject access/erasure requests; no such flow exists in this slice, and erasure interacts with the append-only audit (F9). | **Medium** | Not designed in this slice. Minimisation reduces exposure, but a lawful-basis + subject-rights + audit-vs-erasure reconciliation decision is **DPO/owner-owned** and **unresolved**. Raised as a residual gate (see §5). | **SEC-CHK-13** (post-decision): once the owner decides lawful basis + erasure handling, verify an erasure request removes/pseudonymises `household_ref` in E1 while preserving the tamper-evident audit per the agreed rule. |

### 3.4 Denial of service / abuse
OWASP: **A04 Insecure Design** (rate limiting), availability.

| ID | Threat | Rating | Mitigation (owner) | Check for QA (600) |
|----|--------|:------:|--------------------|--------------------|
| **F14** | **Claim-spam / enumeration** — a resident (or compromised session) hammers the reserve/read surface to grief-book, enumerate the grid, or exhaust the free-tier store budget. | **Medium** | No rate limiting is specified in any input. Scale-to-zero + pay-per-request store means abuse maps to cost (GATE-BUDGET-1) as well as availability. Honest degraded mode (`couldn't-confirm`) avoids fake success under load. **No control present — raised as a gap.** | **SEC-CHK-14:** define and test a per-session/ per-household request-rate limit on both surfaces; assert abusive burst is throttled without breaking a legitimate simultaneous-claim (does not defeat SEC-CHK-5). Owner confirms acceptable-use + any cost cap (GATE-BUDGET-1). |
| **F15** | **Store outage weaponised** — forcing `couldn't-confirm` to confuse users. | **Low** | Honest failure preferred over fake success (DA3/C5); client re-reads truth; alert A1 + KS-3 read-only (800). No integrity or PII impact. | **SEC-CHK-15** (= T18): injected store timeout returns `couldn't-confirm` with **no** partial holder written; audit records `couldn't-confirm`. |

### 3.5 Configuration / supply-chain / secrets
OWASP: **A05 Security Misconfiguration**, **A06 Vulnerable Components**.

| ID | Threat | Rating | Mitigation (owner) | Check for QA (600) |
|----|--------|:------:|--------------------|--------------------|
| **F16** | **Secret leakage** — store/session credential in image, repo, logs, or this doc. | **Medium** | Secrets in platform secret manager only; RC-9 "no PII/secrets in image, logs, or repo"; this run stores no secret (800). | **SEC-CHK-16** (= RC-9): scan image, repo, config, and logs for credential/secret material — none present; secrets resolved only from the secret manager at runtime. |
| **F17** | **Misconfiguration opens the boundary** — e.g. residency self-check disabled, TLS off, verbose `LOG_LEVEL` leaking PII, wrong `SESSION_VERIFIER` target. | **Medium** | Residency self-check refuses boot on bad region (800); TLS at managed edge; `LOG_LEVEL` controls verbosity. Misconfig of `SESSION_VERIFIER` ties back to F1. | **SEC-CHK-17:** boot-time assertions verified (residency self-check, TLS enforced, `SESSION_VERIFIER` set); a misconfigured region or missing verifier fails safe (refuse/boot-fail), never fails open. |
| **F18** | **Vulnerable dependency / stack** — but no stack is chosen yet (SEAM-800-1 / G-INFRA-1). | **Low (deferred)** | Stack is framework-neutral; cannot scan what is not chosen. Becomes actionable once G-INFRA-1 fixes the stack. | **SEC-CHK-18** (post-stack): once the stack is chosen, run dependency/vulnerability scanning (SCA) and pin versions before release. |

---

## 4. Finding counts by severity

| Severity | Count | IDs |
|----------|:-----:|-----|
| **Critical** | 0 | — |
| **High** | 4 | F1 (session trust / AC-6 root), F6 (store atomicity — integrity dependency), F10 (PII in logs), F11 (EU residency) |
| **Medium** | 8 | F2 (non-resident reach), F9 (audit tamper), F12 (retention/permitted-use), F13 (subject-rights), F14 (rate limit/abuse), F16 (secrets), F17 (misconfig) |
| **Low** | 6 | F3, F4, F5, F7, F8, F15, F18 (F18 = Low/deferred) |

**Total findings: 18** (F1–F18). No Critical: the two integrity-critical items (F1 session trust, F6
store atomicity) are rated High because their mitigations exist but are **unproven** in these inputs —
they hinge on upstream decisions (G3/D1, G-INFRA-1) that are open gates, not on a defect I can confirm.
They would escalate to Critical if the run tried to go production-like without proving them.

---

## 5. Residual risks needing a named human owner (NOT self-accepted)

Per the handoff rule, I rate risk but do **not** accept any residual risk without a named human owner.
Each below is recorded **open**; a real release requires the named owner's sign-off.

| Residual risk | Tied to finding | Why it cannot be self-accepted | Owner (role) | Status |
|---------------|-----------------|--------------------------------|--------------|:------:|
| **RR-1: AC-6 rests on an unproven identity source.** The residents-only boundary is only as strong as the upstream session (G3/D1); its minting/validation is not proven here. | F1 | Accepting identity policy is explicitly a human gate (fallback: "identity policy"). | Identity/Security owner (G3/D1) | **`training-open` → hard-stop for prod** |
| **RR-2: Invariant integrity depends on the store genuinely being atomic.** If G-INFRA-1 picks a non-atomic store, double-booking reopens silently. | F6 | Accepting an integrity/NFR risk is human-owned (mirrors GATE-ARCH-1); disqualifying criterion must be *proven*, not assumed. | Data/Architecture owner + G-INFRA-1 owner | **`training-open`** |
| **RR-3: EU personal-data classification, retention, permitted use.** 30d/90d and PII classification are proposals, not policy. | F12 | Data exposure / retention is explicitly a human gate (GATE-DATA-1). | DPO / Data-Protection owner | **`training-open` (GATE-DATA-1)** |
| **RR-4: Subject-rights (access/erasure) + audit reconciliation** has no designed flow. | F13, F9 | Lawful basis and erasure-vs-immutable-audit is a regulatory owner decision. | DPO / Data-Protection owner | **`recorded-open`** |
| **RR-5: No rate-limiting / acceptable-use control.** Abuse maps to cost and grief-booking. | F14 | Acceptable-use + any spend impact (GATE-BUDGET-1) is owner-owned. | Product owner + Ops (+ GATE-BUDGET-1 for cost) | **`recorded-open`** |

**No residual risk on this list is accepted by this station.** Marking them `training-open` /
`recorded-open` lets the *training* run continue on labelled assumptions; it is **not** production
sign-off.

---

## 6. Security-driven checks handed to QA (Station 600)

These are the named checks from §3, grouped so QA can slot them into the test plan alongside the 500
test table (T-numbers cross-referenced). Priority marks the security-critical ones.

| Check | Verifies (finding) | Cross-ref | Priority |
|-------|--------------------|-----------|:--------:|
| **SEC-CHK-1 / 1b** | Absent/invalid/expired/tampered session refused; token-substitution/replay cannot act as another household | F1 (AC-6 root) | **P1** |
| **SEC-CHK-2** | Non-resident + unauthenticated refused on both surfaces; no record/audit | F2 | T8 | **P1** |
| **SEC-CHK-3** | Client-supplied holder in body ignored; hold attributed to session household | F3 | T9 | P2 |
| **SEC-CHK-4** | `taken-other` leaks no holder identity to client | F4 | P2 |
| **SEC-CHK-5** | 2 (and N≫2) simultaneous claims → one winner, one holder, loser untouched | F5 | T13/T14 | **P1** |
| **SEC-CHK-6** | Concurrency proof + DQ-1 run against the **real chosen store in-EU** | F6 | RC-1/DQ-1 | **P1** |
| **SEC-CHK-7** | Refused attempt leaves existing hold byte-for-byte unchanged | F7 | T12 | P2 |
| **SEC-CHK-8** | Idempotent retry never overwrites a different household's hold | F8 | T15 | P2 |
| **SEC-CHK-9** | E4 audit is append-only; update/delete before expiry rejected | F9 | DQ-5 | P2 |
| **SEC-CHK-10** | `household_ref` in **no** log/trace/error/metric across all paths | F10 | T16/DQ-4 | **P1** |
| **SEC-CHK-11** | Non-EU region fails to boot; `residency_check_failed_total==0`; no non-EU export/backup | F11 | RC-3 | **P1** |
| **SEC-CHK-12** | Retention purge + permitted-use limited to 3 uses (after GATE-DATA-1) | F12 | RC (post-gate) | P2 |
| **SEC-CHK-13** | Erasure removes/pseudonymises E1 holder while preserving audit rule (after owner decision) | F13 | P3 (post-gate) |
| **SEC-CHK-14** | Rate limit throttles abuse without defeating legitimate concurrent claim | F14 | P2 |
| **SEC-CHK-15** | Store timeout → `couldn't-confirm`, no partial write | F15 | T18 | P3 |
| **SEC-CHK-16** | No secrets in image/repo/config/logs; secret-manager-only | F16 | RC-9 | P2 |
| **SEC-CHK-17** | Boot-time fail-safe assertions (residency, TLS, verifier) never fail open | F17 | P2 |
| **SEC-CHK-18** | SCA / dependency scan after stack chosen (G-INFRA-1) | F18 | P3 (post-stack) |

**P1 (must be green before any production-like use):** SEC-CHK-1/1b, 2, 5, 6, 10, 11 — the AC-6 root,
the invariant integrity on the real store, and the two PII controls (logs + EU residency).

---

## 7. Human gates carried forward (sharpened where security-relevant)

| Gate | Security sharpening | Status |
|------|---------------------|--------|
| **G3 / D1 (identity source) — SHARPENED to a security dependency.** | The AC-6 residents-only boundary depends **entirely** on the upstream session assertion at TB-2, which is **unproven** in these inputs. I flag it as the top security dependency (F1/RR-1): SEC-CHK-1/1b must run against the *real* verifier, and the identity/session validation policy must be owner-confirmed. Consuming an unproven identity source is acceptable for the training run only under a labelled assumption; a real release must prove it. | **`training-open` → hard-stop for prod** (was `recorded-open`) |
| **GATE-DATA-1 (classification / retention / residency / permitted use).** | Confirmed as the governing personal-data gate for `household_ref` (F10–F13). Retention (30d/90d), EU residency, PII classification, permitted-use limits, and the unresolved **subject-rights/erasure** question (F13/RR-4) are all owner-owned. I add subject-rights + audit-vs-erasure reconciliation as an explicit sub-item. Blocks production-like use until signed off. | **`training-open`** |
| **GATE-ARCH-1 (concurrency mechanism = Option A).** | The entire integrity posture (F5–F8) assumes Option A. Security's F6/RR-2 sharpens R1: the store's atomicity must be **proven on the real store in-EU** (SEC-CHK-6/RC-1), not assumed. | **`training-open`** |
| **G1 (slot grid granularity).** | Security-relevant only via R5: the UC-1 uniqueness must guard the **right** unit; a wrong `slot_key` granularity could allow overlapping "distinct" slots that are physically the same window (an integrity edge). Owner must fix grid before release (RC-10); QA should assert DQ-3 (every used `slot_key` exists in the grid). | **`recorded-open`** |
| **G2 (cancellation/release).** | Out of scope and **security-relevant if reopened**: a free-slot transition would need its own concurrency-safe write (mirror of ADR-001) **and** its own authz check (only the holder may release), plus an audit event — otherwise release becomes a new hold-theft surface. Flagged, not designed. | **`recorded-open`** |
| **GATE-BUDGET-1 / G-INFRA-1 / G-INFRA-2 / GATE-REL-1** | Carried from 800. Security touchpoints: G-INFRA-1 store choice must pass SEC-CHK-6 + SEC-CHK-11 (atomic + EU); G-INFRA-2 access provisioning is an authorisation decision (least-privilege deploy access — owner-owned); GATE-REL-1 release must have all P1 checks green. | **as per 800** |

### New human gate raised by Security

- **GATE-SEC-1 (identity/session policy + subject-rights acceptance — needs owner):** Combines RR-1
  (prove the AC-6 identity root, F1) and RR-4 (lawful basis + erasure-vs-audit, F13). These are
  identity-policy and data-exposure decisions the fallback spec explicitly reserves for a human. The
  training run continues on labelled assumptions; a real release requires the Identity/Security owner
  and DPO to sign off. **`training-open` → hard-stop for prod.** Not self-accepted.

---

## Labelled assumptions made by Security

- **LA-SEC-1 (identity root assumed sound for the run only):** F1/RR-1 — the run proceeds assuming the
  upstream session correctly asserts `isResident`/`householdRef`; this is a labelled assumption pending
  GATE-SEC-1, **not** verification of the identity source.
- **LA-SEC-2 (store atomicity assumed for the run only):** F6/RR-2 — Option A's store is assumed atomic
  to let the review proceed; the real store must pass SEC-CHK-6/RC-1 in-EU. Not sign-off.
- **LA-SEC-3 (proposed data policy treated as placeholder):** the 30d/90d retention, EU classification,
  and permitted-use limits are treated as proposals pending GATE-DATA-1, not as accepted policy.
- **LA-SEC-4 (no rate limiting present):** F14 is raised as a real gap, not assumed mitigated; a control
  is recommended and its acceptable-use policy is owner-owned.

## Done-when check

QA (600) can turn every finding into a test: §6 hands 18 named checks (SEC-CHK-1..18) cross-referenced
to the 500 test table and the 800 release checklist, with six **P1** security-critical checks called
out. Delivery (1000) can see exactly what must be approved before rollout: five residual risks (RR-1..5)
each needing a named owner, and the human gates GATE-SEC-1 (new), G3/D1 (sharpened), GATE-DATA-1,
GATE-ARCH-1, G1, G2, plus the infra/budget/release gates — none self-accepted by this station.
