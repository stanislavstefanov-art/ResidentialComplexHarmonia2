# deploy.ps1 — prompt values

`scripts/deploy.ps1` (Phase 1) prompts for a few inputs and writes them into Key Vault
via the Bicep deployment. **Pressing Enter past the Entra prompts writes a blank value
and wipes the AzureAd secrets — that makes every API request return 500** (the auth
middleware throws `IDW10106: The 'ClientId' option must be provided`, which the browser
then surfaces as a misleading CORS error). Use the exact values below.

> The guarded `deploy.ps1` now keeps the existing Key Vault value when you press Enter and
> refuses to deploy a blank Entra value — but only once the secrets hold correct values
> again. For the recovery run they are currently blank, so you must type them.

## Values to enter at each prompt

| Prompt | Value |
|---|---|
| `SQL admin password` | *(the real SQL admin password — NOT stored here; a secret)* |
| `VAPID subject` | `mailto:stanislav.stefanov@gmail.com` *(any valid mailto; keep prior if unsure)* |
| `Entra instance URL` | `https://residenceharmonia.ciamlogin.com/` |
| `Entra client ID (app registration GUID)` | `d878bdc3-eb45-4dfb-96ad-3cb0ace68ebf` |
| `Entra tenant ID (GUID)` | `28bd994b-6208-43ef-8a44-4ef2efccd991` |

## Why these are safe to record

The three Entra values are **public identifiers**, not secrets. They are already committed
and shipped to every browser in the SPA config:

- `ui/react/src/authConfig.ts` — `CLIENT_ID`, `AUTHORITY` (`https://residenceharmonia.ciamlogin.com/<tenantId>`)
- `ui/angular/src/environments/environment.ts` / `environment.prod.ts` — `clientId`, `authority`

Single app registration: the SPA and API share client ID `d878bdc3-…`; the API scope is
`api://d878bdc3-eb45-4dfb-96ad-3cb0ace68ebf/api_access`. So the API's `AzureAd:ClientId`
equals the SPA's client ID.

The **SQL admin password** is a genuine secret and is intentionally left out of this file.

## After running

Key Vault references refresh on their own, but to pick up the restored secrets immediately:

```
az webapp restart -g rg-residence-harmonia-prod -n residenceharmonia-api
```

Then verify auth is back (should be 200/401, not 500):

```
curl -s -o /dev/null -w "%{http_code}\n" https://residenceharmonia-api.azurewebsites.net/health
```
