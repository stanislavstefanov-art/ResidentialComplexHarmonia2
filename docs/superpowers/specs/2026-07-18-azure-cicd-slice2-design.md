# Azure CI/CD Slice 2 — UI API URL Configuration Design

**Slice:** 2 of 4 (Azure deployment preparation)
**Date:** 2026-07-18
**Branch:** feat/azure-cicd-slice2

---

## Goal

Remove all hardcoded `http://localhost:5000` API base URLs from the Angular and React UIs so each app can target a configurable API host at build time. Add `staticwebapp.config.json` to both UIs to enable SPA client-side routing on Azure Static Web Apps.

No backend changes. No test file changes. No IaC or CI/CD YAML in scope.

---

## 1. React — `src/api/config.ts`

**New file:** `ui/react-prototype/src/api/config.ts`

```ts
export const API_BASE = process.env.REACT_APP_API_URL ?? 'http://localhost:5000';
```

All 9 api source files replace their module-level `const BASE = 'http://localhost:5000'` with:

```ts
import { API_BASE } from './config';
const BASE = API_BASE;
```

**Affected source files:**
`reservations.ts`, `expenses.ts`, `financial.ts`, `maintenanceFees.ts`, `payments.ts`, `notifications.ts`, `contactEdit.ts`, `privacy.ts`, `directory.ts`

**Test files:** unchanged. In Jest, `process.env.REACT_APP_API_URL` is `undefined`, so `API_BASE` resolves to `'http://localhost:5000'` and all `expect(fetch).toHaveBeenCalledWith(...)` assertions continue to match.

**Local dev:** no `.env.development` file needed — the `?? 'http://localhost:5000'` fallback in `config.ts` covers it.

**Production:** Slice 4 GitHub Actions sets `REACT_APP_API_URL=<Container App HTTPS URL>` as an environment variable before running `npm run build`. CRA bakes the value in at build time.

---

## 2. Angular — environment files + `fileReplacements`

**New files:**

`ui/angular-prototype/src/environments/environment.ts`:
```ts
export const environment = {
  apiUrl: 'http://localhost:5000'
};
```

`ui/angular-prototype/src/environments/environment.prod.ts`:
```ts
export const environment = {
  apiUrl: ''
};
```

Empty string in `environment.prod.ts` is an explicit placeholder. Slice 4 GitHub Actions will inject the real Container App URL before building — either via `sed` replacement or an additional `--configuration staging` / `--configuration production` environment file.

**`angular.json` change:** add `fileReplacements` to the existing `production` configuration:

```json
"production": {
  "fileReplacements": [
    {
      "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.prod.ts"
    }
  ],
  "budgets": [ ... ],
  "outputHashing": "all"
}
```

**All 9 service files** replace `const API = 'http://localhost:5000'` with:

```ts
import { environment } from '../../environments/environment';
const API = environment.apiUrl;
```

**Affected service files:**
`reservations/reservations.service.ts`, `expenses/expense.service.ts`, `financial/financial.service.ts`, `maintenance-fees/maintenance-fee.service.ts`, `payments/payment.service.ts`, `notifications/notification.service.ts`, `contact-edit/contact-edit.service.ts`, `privacy/privacy.service.ts`, `directory/directory.service.ts`

**Spec files:** unchanged. Tests run under the dev build config; `environment.apiUrl = 'http://localhost:5000'`, so all `http.expectOne('http://localhost:5000/...')` calls continue to match.

---

## 3. `staticwebapp.config.json` — both UIs

`ui/angular-prototype/staticwebapp.config.json`:
```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/*.{css,js,png,svg,ico,woff,woff2,map}"]
  }
}
```

`ui/react-prototype/staticwebapp.config.json`: identical content.

Fixes hard-refresh 404s on any client-side route on Azure Static Web Apps. The `exclude` list prevents the fallback from intercepting static asset requests or API calls. No proxy configuration — the UIs call the Container App URL directly; CORS is handled by Slice 1's `app.UseCors()` middleware.

---

## 4. Files changed

| File | Action |
|---|---|
| `ui/react-prototype/src/api/config.ts` | Create |
| `ui/react-prototype/src/api/reservations.ts` | Modify |
| `ui/react-prototype/src/api/expenses.ts` | Modify |
| `ui/react-prototype/src/api/financial.ts` | Modify |
| `ui/react-prototype/src/api/maintenanceFees.ts` | Modify |
| `ui/react-prototype/src/api/payments.ts` | Modify |
| `ui/react-prototype/src/api/notifications.ts` | Modify |
| `ui/react-prototype/src/api/contactEdit.ts` | Modify |
| `ui/react-prototype/src/api/privacy.ts` | Modify |
| `ui/react-prototype/src/api/directory.ts` | Modify |
| `ui/react-prototype/staticwebapp.config.json` | Create |
| `ui/angular-prototype/src/environments/environment.ts` | Create |
| `ui/angular-prototype/src/environments/environment.prod.ts` | Create |
| `ui/angular-prototype/angular.json` | Modify — add `fileReplacements` to production config |
| `ui/angular-prototype/src/app/reservations/reservations.service.ts` | Modify |
| `ui/angular-prototype/src/app/expenses/expense.service.ts` | Modify |
| `ui/angular-prototype/src/app/financial/financial.service.ts` | Modify |
| `ui/angular-prototype/src/app/maintenance-fees/maintenance-fee.service.ts` | Modify |
| `ui/angular-prototype/src/app/payments/payment.service.ts` | Modify |
| `ui/angular-prototype/src/app/notifications/notification.service.ts` | Modify |
| `ui/angular-prototype/src/app/contact-edit/contact-edit.service.ts` | Modify |
| `ui/angular-prototype/src/app/privacy/privacy.service.ts` | Modify |
| `ui/angular-prototype/src/app/directory/directory.service.ts` | Modify |
| `ui/angular-prototype/staticwebapp.config.json` | Create |

---

## 5. Out of scope

- Test file changes (Angular specs and React tests pass without modification)
- Bicep IaC — Slice 3
- GitHub Actions CD workflow — Slice 4
- Actual Container App URL (unknown until Slice 3 provisions infrastructure)
- SWA proxy route / linked backend configuration (Slice 3/4)
- Auth integration in Angular or React UIs
- Angular dev server proxy configuration (`proxy.conf.json`)
