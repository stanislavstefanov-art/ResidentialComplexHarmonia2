# Azure CI/CD Slice 4 — CD Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub Actions CD workflow that triggers after CI passes on master, builds and pushes the API image to ACR, updates the Container App, and deploys both Static Web Apps; fix acr.bicep so the managed identity has AcrPush (not just AcrPull).

**Architecture:** Two files change. `infra/modules/acr.bicep` gets a one-line role ID update (AcrPull → AcrPush). `.github/workflows/cd.yml` is created with four jobs: `build-push-api` → `deploy-api` (sequential), and `deploy-angular` + `deploy-react` (parallel, independent). All jobs gate on `github.event.workflow_run.conclusion == 'success'`.

**Tech Stack:** GitHub Actions, azure/login@v2 (OIDC), docker/build-push-action@v5, azure/static-web-apps-deploy@v1, Azure CLI, Bicep.

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `infra/modules/acr.bicep` | Modify lines 17–27 | Change role from AcrPull to AcrPush so the OIDC identity can push images |
| `.github/workflows/cd.yml` | Create | Four-job CD pipeline triggered by CI workflow_run on master |

---

### Task 1: Fix acr.bicep — AcrPull → AcrPush

**Files:**
- Modify: `infra/modules/acr.bicep` lines 17–27

No shell access is required for this task beyond `az bicep build` to lint. The implementer
writes the file; the coordinator runs the lint.

- [ ] **Step 1: Confirm current state**

Read `infra/modules/acr.bicep`. Verify line 17 contains:
```
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
```
This is the AcrPull role. AcrPush (`8311e382-0749-4cb8-b61a-304f252e45ec`) is a superset —
it includes pull, so the Container App runtime still works after this change.

- [ ] **Step 2: Apply the change**

Replace lines 17–27 of `infra/modules/acr.bicep` with:

```bicep
var acrPushRoleId = '8311e382-0749-4cb8-b61a-304f252e45ec'

resource acrPushAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, identityPrincipalId, acrPushRoleId)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPushRoleId)
    principalId: identityPrincipalId
    principalType: 'ServicePrincipal'
  }
}
```

The complete file after the edit:

```bicep
@minLength(2)
param namePrefix string
param location string
param identityPrincipalId string

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: '${namePrefix}acr'
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
  }
}

var acrPushRoleId = '8311e382-0749-4cb8-b61a-304f252e45ec'

resource acrPushAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, identityPrincipalId, acrPushRoleId)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPushRoleId)
    principalId: identityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output loginServer string = acr.properties.loginServer
output acrName string = acr.name
```

- [ ] **Step 3: Lint**

```bash
az bicep build --file infra/modules/acr.bicep
```

Expected: only the upgrade warning, no errors or rule violations.

- [ ] **Step 4: Commit**

```bash
git add infra/modules/acr.bicep
git commit -m "fix(infra): upgrade ACR role from AcrPull to AcrPush for OIDC push access"
```

---

### Task 2: Create `.github/workflows/cd.yml`

**Files:**
- Create: `.github/workflows/cd.yml`

- [ ] **Step 1: Verify the file does not exist**

```bash
ls .github/workflows/
```

Expected: only `ci.yml` is listed. If `cd.yml` already exists, stop and investigate.

- [ ] **Step 2: Create the workflow file**

Create `.github/workflows/cd.yml` with the following exact content:

```yaml
name: CD

on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [master]

permissions:
  id-token: write
  contents: read

env:
  RESOURCE_GROUP: rg-residence-harmonia-prod
  ACR_LOGIN_SERVER: harmoniaacr.azurecr.io
  CONTAINER_APP_NAME: harmonia-api

jobs:
  build-push-api:
    if: github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.tag.outputs.image-tag }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.workflow_run.head_sha }}

      - name: Azure login
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: ACR login
        run: az acr login --name harmoniaacr

      - name: Set image tag
        id: tag
        run: echo "image-tag=${{ github.event.workflow_run.head_sha }}" >> "$GITHUB_OUTPUT"

      - uses: docker/setup-buildx-action@v3

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            harmoniaacr.azurecr.io/harmonia-api:${{ github.event.workflow_run.head_sha }}
            harmoniaacr.azurecr.io/harmonia-api:latest

  deploy-api:
    needs: [build-push-api]
    if: github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    steps:
      - name: Azure login
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Update Container App
        run: |
          az containerapp update \
            --name ${{ env.CONTAINER_APP_NAME }} \
            --resource-group ${{ env.RESOURCE_GROUP }} \
            --image ${{ env.ACR_LOGIN_SERVER }}/harmonia-api:${{ needs.build-push-api.outputs.image-tag }}

  deploy-angular:
    if: github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.workflow_run.head_sha }}

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: ui/angular-prototype/package-lock.json

      - name: Install dependencies
        working-directory: ui/angular-prototype
        run: npm ci

      - name: Build Angular
        working-directory: ui/angular-prototype
        run: npm run build -- --configuration production

      - name: Deploy to Angular SWA
        uses: azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.ANGULAR_SWA_DEPLOY_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: upload
          app_location: ui/angular-prototype
          output_location: dist/angular-prototype/browser
          skip_app_build: true

  deploy-react:
    if: github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.workflow_run.head_sha }}

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: ui/react-prototype/package-lock.json

      - name: Install dependencies
        working-directory: ui/react-prototype
        run: npm ci

      - name: Build React
        working-directory: ui/react-prototype
        run: npm run build

      - name: Deploy to React SWA
        uses: azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.REACT_SWA_DEPLOY_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: upload
          app_location: ui/react-prototype
          output_location: build
          skip_app_build: true
```

- [ ] **Step 3: Validate YAML syntax**

```bash
python3 -c "import sys, yaml; yaml.safe_load(open('.github/workflows/cd.yml')); print('YAML valid')"
```

Expected output: `YAML valid`

If Python is not available: `node -e "const fs=require('fs'); JSON.stringify(require('js-yaml').load(fs.readFileSync('.github/workflows/cd.yml','utf8'))); console.log('valid')"` — but Python is standard on ubuntu-latest so it will always be available in CI.

- [ ] **Step 4: Verify job dependency structure by reading the file**

Confirm the following by inspection:
- `build-push-api` has `if: github.event.workflow_run.conclusion == 'success'` and `outputs: image-tag`
- `deploy-api` has `needs: [build-push-api]` and references `${{ needs.build-push-api.outputs.image-tag }}`
- `deploy-angular` and `deploy-react` have no `needs` (start in parallel)
- All four jobs have the `if:` guard
- Checkout uses `ref: ${{ github.event.workflow_run.head_sha }}` (not `github.sha`)

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/cd.yml
git commit -m "feat(cd): add GitHub Actions CD workflow (build+push, Container App, SWA×2)"
```

---

## Post-implementation checklist (human steps, not automated)

Before the first CD run can succeed, a human must:

1. Add 5 GitHub secrets (repo Settings → Secrets → Actions):
   - `AZURE_CLIENT_ID` — from `az deployment group show -g rg-residence-harmonia-prod -n main --query properties.outputs.managedIdentityClientId.value -o tsv`
   - `AZURE_TENANT_ID` — from `az account show --query tenantId -o tsv`
   - `AZURE_SUBSCRIPTION_ID` — from `az account show --query id -o tsv`
   - `ANGULAR_SWA_DEPLOY_TOKEN` — from `az staticwebapp secrets list --name harmonia-angular-swa --resource-group rg-residence-harmonia-prod --query "properties.apiKey" -o tsv`
   - `REACT_SWA_DEPLOY_TOKEN` — from `az staticwebapp secrets list --name harmonia-react-swa --resource-group rg-residence-harmonia-prod --query "properties.apiKey" -o tsv`

2. Re-run `az deployment group create` after the acr.bicep fix merges, to apply the AcrPush role assignment.

3. Populate VAPID and ACS secrets in Key Vault if not already done (required for the container to start — see Slice 3 spec §6).
