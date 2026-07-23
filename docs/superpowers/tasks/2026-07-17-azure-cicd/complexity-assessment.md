# Complexity Assessment — Azure CI/CD Pipeline

**Task:** Add GitHub Actions CI/CD pipeline deploying Harmonia to Azure: API to Azure Container Apps, Angular and React UIs to Azure Static Web Apps, Azure SQL for the database. Two environments (staging + production). Secrets via Azure Key Vault. GitHub Actions with OIDC federated identity.

**Verdict: SPLIT REQUIRED (XXL — total score 34/36)**

---

## Dimension Scores

| Dimension | Score | Label | Notes |
|---|---|---|---|
| Component Scope | 6 | XXL | 5+ distinct components; multiple new external service integrations (red flag applied) |
| Requirements Clarity | 5 | XL | ADR-0005 scope conflict open; IaC vs. manual provisioning unresolved (red flag applied) |
| Technical Risk | 6 | XXL | Everything is net-new; OIDC + Key Vault security; EU constraint; low reversibility |
| File Change Estimate | 6 | XXL | 28–35 files minimum (Dockerfile, Program.cs, ~18 service files, 2x staticwebapp.config.json, 2+ YAML, IaC files) |
| Dependencies | 5 | XL | 5+ new external service integrations (ACR, Container Apps, Static Web Apps, Key Vault, OIDC) |
| Affected Layers | 6 | XXL | API, External, Workflow/Pipeline, DB-Persistence, and frontend — all layers touched (red flag applied) |

**Total: 34 / 36**

---

## Routing

**SPLIT REQUIRED.** Score 34 is in the XXL band (32–36). This is a hard block — do not attempt to plan or implement this as a single unit. Decompose first.

---

## Red Flags Applied

1. **Component Scope XL → XXL:** Integration with multiple new external services (ACR, Container Apps, Static Web Apps, Key Vault, OIDC) — each is a distinct integration surface.
2. **Affected Layers XL → XXL:** Those same integrations cross every layer boundary in the taxonomy.
3. **Technical Risk (held at XXL):** Security/compliance flag for OIDC federated identity, Key Vault zero-fault-tolerance wiring, and EU data-residency constraint (westeurope/northeurope).
4. **Requirements Clarity L → XL:** ADR-0005 explicitly records that UIs have "no CI pipeline" — this is a scope extension requiring a human decision before any work starts. IaC vs. manual provisioning is also explicitly unresolved.

---

## Human Gates Required Before Any Slice Starts

- **ADR-0005 conflict:** The existing ADR records "UIs have no CI pipeline." Including Angular and React in this CI/CD task extends that scope. A human owner must explicitly approve this extension and update ADR-0005 before frontend pipeline work begins.
- **IaC vs. manual provisioning:** The technical analysis notes Azure resources "must be manually pre-provisioned or IaC authored." This is a significant fork — IaC (Bicep/Terraform) adds ~1 L-sized slice of its own work; manual provisioning creates an undocumented runbook dependency. A human owner must decide and document the choice.

---

## Recommended Split (4 Slices)

### Slice 1 — API Containerisation and Health Readiness
**Scope:** Author Dockerfile for Harmonia.Api. Add `/health` endpoint to `Program.cs`. Add CORS middleware configured for SWA origins. Verify `docker build` and `docker run` locally. No pipeline changes, no Azure resources.

**Files changed (estimate: 3–5):** `Dockerfile` (new), `Program.cs`, `appsettings.json` or health-check registration file, possibly a `docker-compose.override.yml` for local dev.

**Exit criterion:** `docker build` succeeds; `/health` returns HTTP 200; CORS headers present for a SWA origin.

**Why first:** Unblocks Slice 4 (pipeline cannot push an image that doesn't build) and Slice 3 (Container Apps health probe must be known before resource config).

---

### Slice 2 — Frontend Environment Awareness
**Scope:** Replace all hardcoded `http://localhost:5000` references across Angular and React service files with environment-variable-driven API base URL. Add `staticwebapp.config.json` to both UIs (SPA routing + API proxy config). Add Angular `environment.prod.ts` if missing.

**Files changed (estimate: 20–22):** ~18 Angular/React service files, 2x `staticwebapp.config.json` (new), 2x Angular environment files.

**Exit criterion:** Both UIs build and serve against a configurable API base URL; no `localhost` references remain in source; SPA routing works on direct URL access.

**Why second:** Independent of Slice 1 and Slice 3. Can be reviewed and merged in parallel with Slice 1.

---

### Slice 3 — Azure Infrastructure Provisioning
**Precondition:** Human gate on IaC vs. manual decision must be resolved. Human gate on ADR-0005 must be resolved.

**Scope:** Author Bicep or Terraform (or write a manual runbook) for ACR, Container Apps (staging + production), Static Web Apps (staging + production), Azure SQL, Key Vault, and managed identity / OIDC app registration. Enforce EU region (westeurope/northeurope). Populate Key Vault with all 6 connection strings.

**Files changed (estimate: 5–12):** Bicep/Terraform modules (multiple new files), or a provisioning runbook document.

**Exit criterion:** All Azure resources exist in both environments; OIDC federated credentials configured in GitHub; Key Vault holds all 6 secrets; a manual smoke-call to the Container Apps health endpoint returns 200.

---

### Slice 4 — GitHub Actions CD Pipeline
**Precondition:** Slices 1, 2, and 3 merged.

**Scope:** Extend existing `ci.yml` or author new CD workflow files. Implement: build API image → push to ACR → deploy to Container Apps; build Angular → deploy to Static Web Apps; build React → deploy to Static Web Apps. Staging auto-deploys on push to `main`. Production requires manual approval (environment protection rule). Secrets sourced via OIDC + Key Vault references, not stored as GitHub Secrets plaintext.

**Files changed (estimate: 2–4):** `.github/workflows/cd-staging.yml` (new), `.github/workflows/cd-production.yml` (new), possibly updated `ci.yml`.

**Exit criterion:** A commit to `main` triggers a successful staging deployment end-to-end. A production deployment is gated on manual approval and succeeds when approved. No secrets stored as plaintext in workflow files.

---

## Key Technical Findings Driving This Assessment

| Finding | Impact |
|---|---|
| No Dockerfile for Harmonia.Api | Slice 1 must author one from scratch |
| No `/health` endpoint | Required by Container Apps — Slice 1 must add it |
| CORS not configured in Program.cs | Must add middleware for SWA origins — Slice 1 |
| ~18 Angular/React service files with hardcoded `localhost:5000` | Slice 2 is a non-trivial sweep across both frontends |
| No `staticwebapp.config.json` in either UI | SPA routing breaks without it — Slice 2 |
| No IaC exists | Slice 3 is net-new infrastructure authoring, not config adjustment |
| No ACR exists | Container image has nowhere to land until Slice 3 completes |
| 6 connection strings, all required at startup | Key Vault wiring is zero-fault-tolerance — one missing secret = complete startup failure |
| Entra External ID setup remains manual (ADR-0003) | Out of scope for this pipeline task; must be documented as a dependency |
| ADR-0005: UIs have "no CI pipeline" | Scope extension — human gate required before Slice 2 pipeline work begins |
| Existing `ci.yml` has no CD steps | CD is entirely net-new, not an extension of existing work |
| EU region constraint | All Azure resources must be in westeurope or northeurope |
