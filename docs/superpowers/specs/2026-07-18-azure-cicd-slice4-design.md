# Azure CI/CD Slice 4 — GitHub Actions CD Workflow Design

**Slice:** 4 of 4 (continuous deployment)
**Date:** 2026-07-18
**Branch:** feat/azure-cicd-slice4

---

## Goal

Add a CD workflow that triggers automatically after CI passes on `master`: builds and pushes the
API Docker image to ACR, updates the Container App to the new revision, and deploys both Static
Web Apps. Uses the OIDC federated identity from Slice 3 — no stored Azure credentials.

---

## 1. Files

```
.github/workflows/cd.yml     — new CD workflow (four jobs)
infra/modules/acr.bicep      — fix: AcrPull → AcrPush for the managed identity
```

The `acr.bicep` change is a one-line role ID update. `AcrPush` is a superset of `AcrPull`
so the Container App runtime pull continues to work.

---

## 2. GitHub secrets (one-time manual setup)

Set these in repo **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | How to obtain |
|---|---|
| `AZURE_CLIENT_ID` | Bicep output `managedIdentityClientId` from initial `az deployment group create` |
| `AZURE_TENANT_ID` | `az account show --query tenantId -o tsv` |
| `AZURE_SUBSCRIPTION_ID` | `az account show --query id -o tsv` |
| `ANGULAR_SWA_DEPLOY_TOKEN` | `az staticwebapp secrets list --name harmonia-angular-swa --resource-group rg-residence-harmonia-prod --query "properties.apiKey" -o tsv` |
| `REACT_SWA_DEPLOY_TOKEN` | `az staticwebapp secrets list --name harmonia-react-swa --resource-group rg-residence-harmonia-prod --query "properties.apiKey" -o tsv` |

---

## 3. Workflow trigger

```yaml
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [master]
```

All jobs are gated on `if: github.event.workflow_run.conclusion == 'success'`. If CI fails,
no deployment job starts. The existing `ci.yml` is unchanged.

---

## 4. Permissions

```yaml
permissions:
  id-token: write   # OIDC token for azure/login
  contents: read
```

Set at the workflow level. SWA deploy jobs don't use OIDC but the permission is harmless.

---

## 5. Top-level env

```yaml
env:
  RESOURCE_GROUP: rg-residence-harmonia-prod
  ACR_LOGIN_SERVER: harmoniaacr.azurecr.io
  CONTAINER_APP_NAME: harmonia-api
```

These are stable names derived from `namePrefix=harmonia`, not secrets.

---

## 6. Job dependency graph

```
[CI passes on master]
        │
        ├── build-push-api        — OIDC login, az acr login, docker build+push
        │         └── deploy-api  — OIDC login, az containerapp update
        │
        ├── deploy-angular        — npm ci, ng build --configuration production, SWA deploy
        └── deploy-react          — npm ci, npm run build, SWA deploy
```

`deploy-angular` and `deploy-react` start immediately (no `needs`). They use the deploy token
secret directly and do not require OIDC or Azure CLI.

---

## 7. Job details

### `build-push-api`

1. Checkout at `${{ github.event.workflow_run.head_sha }}` — required with `workflow_run`
   trigger; the default `github.sha` points to the CD workflow file, not the triggering commit.
2. `azure/login@v2` with OIDC (client-id, tenant-id, subscription-id secrets).
3. `az acr login --name harmoniaacr` — authenticates Docker daemon to ACR using the OIDC session.
4. `docker/build-push-action@v5` — builds from repo root `Dockerfile`, pushes two tags:
   - `harmoniaacr.azurecr.io/harmonia-api:<head-sha>` — pinned, used by deploy-api
   - `harmoniaacr.azurecr.io/harmonia-api:latest` — convenience alias
5. Exposes `image-tag` as a job output (the head SHA) for `deploy-api`.

### `deploy-api`

`needs: [build-push-api]`

1. `azure/login@v2` (same OIDC secrets — jobs don't share auth state).
2. `az containerapp update --name harmonia-api --resource-group rg-residence-harmonia-prod --image harmoniaacr.azurecr.io/harmonia-api:<image-tag>`

Container Apps creates a new revision automatically on image change.

### `deploy-angular`

No `needs` — starts in parallel with `build-push-api`.

1. Checkout at `${{ github.event.workflow_run.head_sha }}`.
2. `actions/setup-node@v4` with Node 20, npm cache keyed to `ui/angular-prototype/package-lock.json`.
3. `npm ci` in `ui/angular-prototype/`.
4. `npm run build -- --configuration production` in `ui/angular-prototype/`.
   Output: `ui/angular-prototype/dist/angular-prototype/browser/`.
5. `azure/static-web-apps-deploy@v1`:
   - `azure_static_web_apps_api_token`: `${{ secrets.ANGULAR_SWA_DEPLOY_TOKEN }}`
   - `app_location: ui/angular-prototype`
   - `output_location: dist/angular-prototype/browser`
   - `skip_app_build: true`

### `deploy-react`

No `needs` — starts in parallel with `build-push-api`.

1. Checkout at `${{ github.event.workflow_run.head_sha }}`.
2. `actions/setup-node@v4` with Node 20, npm cache keyed to `ui/react-prototype/package-lock.json`.
3. `npm ci` in `ui/react-prototype/`.
4. `npm run build` in `ui/react-prototype/`.
   Output: `ui/react-prototype/build/`.
5. `azure/static-web-apps-deploy@v1`:
   - `azure_static_web_apps_api_token`: `${{ secrets.REACT_SWA_DEPLOY_TOKEN }}`
   - `app_location: ui/react-prototype`
   - `output_location: build`
   - `skip_app_build: true`

---

## 8. `acr.bicep` fix — AcrPush role

Change the role definition ID from `AcrPull` to `AcrPush`:

| Role | ID |
|---|---|
| AcrPull (current) | `7f951dda-4ed3-4680-a7ca-43fe172d538d` |
| AcrPush (required) | `8311e382-0749-4cb8-b61a-304f252e45ec` |

The role assignment resource name (`guid(...)`) and all other acr.bicep content remain unchanged.
After merging and re-running `az deployment group create`, the managed identity gains push access.

---

## 9. Out of scope

- Staging environment / environment-gated promotion
- Bicep infra deploy in the CD workflow (remains a manual one-off)
- Rollback automation
- Container App traffic splitting between revisions
- SWA preview environments for PRs
- Azure Monitor / alerting on failed deployments
