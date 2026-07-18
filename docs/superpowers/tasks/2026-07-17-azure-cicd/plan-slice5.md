# Azure CI/CD Slice 5 — SQL Schema Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `run-schema` job to `.github/workflows/cd.yml` that applies `db/schema.sql` to the Azure SQL database on every CD run, and update `deploy-api` to wait for `run-schema` before activating the new Container App revision.

**Architecture:** One file changes. The new `run-schema` job runs in parallel with `build-push-api`, uses OIDC login (same secrets already required by Slice 4), fetches the ADO.NET connection string from Key Vault via `az keyvault secret show`, parses server FQDN and admin password with Python (env-var injection avoids shell interpolation issues), installs `mssql-tools18`, and runs `sqlcmd` with `SQLCMDPASSWORD` env var. `deploy-api` gains `needs: [build-push-api, run-schema]` so the schema is confirmed before the new revision starts.

**Tech Stack:** GitHub Actions YAML, Azure CLI, Python 3 (pre-installed on ubuntu-latest), mssql-tools18 (sqlcmd), Azure Key Vault, Azure SQL.

---

## File map

| File | Action |
|---|---|
| `.github/workflows/cd.yml` | Modify — add `run-schema` job (after `deploy-react`), update `deploy-api.needs` |

---

### Task 1: Add `run-schema` job and update `deploy-api` needs

**Files:**
- Modify: `.github/workflows/cd.yml`

There is no unit-testable code in this task. The verification steps are: (a) YAML syntax check, (b) structural inspection of the job graph, and (c) review that no secrets appear in the rendered command.

- [ ] **Step 1: Read current `deploy-api` job**

Read `.github/workflows/cd.yml`. Locate the `deploy-api` job. It currently has:

```yaml
deploy-api:
  needs: [build-push-api]
  if: github.event.workflow_run.conclusion == 'success'
```

- [ ] **Step 2: Add `run-schema` job**

In `.github/workflows/cd.yml`, add the following job **after the `deploy-react` job** (at the end of the file). The complete job:

```yaml
  run-schema:
    if: github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
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

      - name: Install sqlcmd
        run: |
          curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
            | sudo tee /etc/apt/trusted.gpg.d/microsoft.asc > /dev/null
          curl -fsSL https://packages.microsoft.com/config/ubuntu/22.04/prod.list \
            | sudo tee /etc/apt/sources.list.d/mssql-release.list > /dev/null
          sudo apt-get update -q
          sudo ACCEPT_EULA=Y apt-get install -yq mssql-tools18 unixodbc-dev
          echo '/opt/mssql-tools18/bin' >> "$GITHUB_PATH"

      - name: Apply schema
        run: |
          CONN_STR=$(az keyvault secret show \
            --vault-name harmoniakv \
            --name ConnectionStrings--Default \
            --query value -o tsv)

          SQL_SERVER=$(CONN_VAR="$CONN_STR" python3 -c \
            "import os; cs=os.environ['CONN_VAR']; d=dict(p.split('=',1) for p in cs.rstrip(';').split(';') if '=' in p); print(d['Server'].replace('tcp:','').rsplit(',',1)[0])")

          SQL_PASS=$(CONN_VAR="$CONN_STR" python3 -c \
            "import os; cs=os.environ['CONN_VAR']; d=dict(p.split('=',1) for p in cs.rstrip(';').split(';') if '=' in p); print(d['Password'])")

          echo "::add-mask::$SQL_PASS"

          SQLCMDPASSWORD="$SQL_PASS" sqlcmd \
            -S "$SQL_SERVER" \
            -d harmonia-db \
            -U harmonia-admin \
            -i db/schema.sql \
            -C \
            -b
```

- [ ] **Step 3: Update `deploy-api` needs**

In the same file, find the `deploy-api` job needs line and change it from:

```yaml
  deploy-api:
    needs: [build-push-api]
```

to:

```yaml
  deploy-api:
    needs: [build-push-api, run-schema]
```

Leave all other `deploy-api` content unchanged.

- [ ] **Step 4: Verify YAML syntax**

Run:
```bash
python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/cd.yml')); print('YAML valid')"
```

Expected output: `YAML valid`

If it prints a YAML error, fix the indentation before continuing. Common pitfall: the `run-schema` job body must be indented at the same level as `build-push-api`, `deploy-api`, `deploy-angular`, and `deploy-react` (2-space indent under `jobs:`).

- [ ] **Step 5: Verify job graph by inspection**

Read `.github/workflows/cd.yml` and confirm all of the following are true:

- `run-schema` exists as a top-level job under `jobs:` with `if: github.event.workflow_run.conclusion == 'success'`
- `run-schema` has **no** `needs:` (it runs in parallel with `build-push-api`)
- `deploy-api` has `needs: [build-push-api, run-schema]`
- `deploy-angular` and `deploy-react` have **no** `needs:` (unchanged)
- The `Apply schema` step uses `CONN_VAR="$CONN_STR" python3 -c` (env-var injection, not inline `$CONN_STR` in the Python string)
- The `Apply schema` step uses `SQLCMDPASSWORD="$SQL_PASS" sqlcmd` (password never appears on the CLI)
- `echo "::add-mask::$SQL_PASS"` appears before the `sqlcmd` call
- `sqlcmd` flags include `-C` (trust server cert) and `-b` (exit non-zero on SQL error)
- All `actions/checkout@v4` steps use `ref: ${{ github.event.workflow_run.head_sha }}`

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/cd.yml
git commit -m "feat(cd): add run-schema job to apply db/schema.sql to Azure SQL on each deploy"
```

---

## Post-implementation checklist (human steps, not automated)

All previously documented manual prerequisites from Slice 4 still apply:

1. `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` GitHub secrets
2. `ANGULAR_SWA_DEPLOY_TOKEN`, `REACT_SWA_DEPLOY_TOKEN` GitHub secrets
3. Run `az deployment group create --resource-group rg-residence-harmonia-prod --template-file infra/main.bicep --parameters infra/main.parameters.json --parameters sqlAdminPassword=<password>` (provisions all infra including the Key Vault secret)
4. Populate VAPID and ACS secrets in Key Vault

No new secrets or manual steps are added by Slice 5. The `run-schema` job reads credentials from the Key Vault secret created in step 3.
