# Azure CI/CD Slice 5 — SQL Schema Migration Design

**Slice:** 5 of 5 (schema migration)
**Date:** 2026-07-18
**Branch:** feat/azure-cicd

---

## Goal

Add a `run-schema` job to the CD workflow that applies `db/schema.sql` to the Azure SQL database on every deployment. The schema script is idempotent (`IF OBJECT_ID ... IS NULL` guards throughout), so running it on every CD is safe. This closes the last gap before Azure deployment works end-to-end: the database currently starts empty and the API crashes on the first call.

---

## 1. Files

```
.github/workflows/cd.yml     — add run-schema job, update deploy-api needs
```

No Bicep changes. CORS is already wired in `api.bicep` (lines 88–93). The `AllowAzureServices` firewall rule is already in `sql.bicep` (lines 34–41), covering GitHub Actions Microsoft-hosted runners.

---

## 2. Authentication

The `run-schema` job authenticates using the same OIDC managed identity as `deploy-api` (secrets `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` — already required by Slice 4).

The managed identity has `Key Vault Secrets User` role (granted in `keyvault.bicep`). The job fetches `ConnectionStrings--Default` from Key Vault and parses it with Python to extract the server FQDN and admin password. No new secrets are required.

Connection string format (from `keyvault.bicep` line 24):
```
Server=tcp:<serverFqdn>,1433;Initial Catalog=<databaseName>;Persist Security Info=False;User ID=harmonia-admin;Password=<sqlAdminPassword>;Encrypt=True;
```

---

## 3. `run-schema` job

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

        # Pass connection string via env var to avoid shell interpolation issues
        # (handles passwords with $, !, quotes, etc.)
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

`-C` trusts the server certificate (required for Azure SQL with `Encrypt=True`). `-b` exits with a non-zero code on any SQL error, failing the job cleanly.

---

## 4. Updated job graph

`deploy-api` is updated to wait for `run-schema` in addition to `build-push-api`:

```yaml
deploy-api:
  needs: [build-push-api, run-schema]
```

Full graph after Slice 5:

```
[CI passes on master]
    ├── build-push-api ──┐
    │                    ├──→ deploy-api
    ├── run-schema ──────┘
    ├── deploy-angular
    └── deploy-react
```

`run-schema` and `build-push-api` run in parallel. `deploy-api` starts only after both succeed — the schema is confirmed applied before the new Container App revision activates.

---

## 5. Idempotency

`db/schema.sql` uses `IF OBJECT_ID('dbo.<Table>', 'U') IS NULL BEGIN CREATE TABLE ... END` guards for all 7 tables. Running it against an already-populated database is a no-op. Running it on a fresh empty database creates all tables. No data loss risk on re-run.

---

## 6. Out of scope

- Health probes on the Container App (nice-to-have, not blocking)
- AAD-only SQL auth (would require one-time `CREATE USER FROM EXTERNAL PROVIDER` manual step — more complex than KV approach)
- Schema versioning / migration history table (Flyway/EF migrations)
- Rollback on schema failure (schema is additive only)
