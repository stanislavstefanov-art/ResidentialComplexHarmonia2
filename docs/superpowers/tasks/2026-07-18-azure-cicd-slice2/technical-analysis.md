# Technical Research — Azure CI/CD Slice 2

**Task**: Replace hardcoded localhost:5000 API URLs in Angular and React UIs; add staticwebapp.config.json
**Date**: 2026-07-18
**Branch**: feat/azure-cicd-slice2
**Research path**: direct codebase reading (full analysis in docs/superpowers/tasks/2026-07-17-azure-cicd/technical-analysis.md)

---

## 1. Codebase Findings

### Affected Files — API URL pattern

**React** (`ui/react-prototype/src/api/`): Each module has `const BASE = 'http://localhost:5000';` at the top.

Source files (9):
- `reservations.ts`, `expenses.ts`, `financial.ts`, `maintenanceFees.ts`, `payments.ts`, `notifications.ts`, `contactEdit.ts`, `privacy.ts`, `directory.ts`

Test files (8, same pattern `const BASE = 'http://localhost:5000'`):
- `reservations.test.ts`, `expenses.test.ts`, `financial.test.ts`, `maintenanceFees.test.ts`, `payments.test.ts`, `notifications.test.ts`, `contactEdit.test.ts`, `privacy.test.ts`

**Angular** (`ui/angular-prototype/src/app/`): Each service has `const API = 'http://localhost:5000';` at the top.

Service files (9):
- `reservations/reservations.service.ts`, `expenses/expense.service.ts`, `financial/financial.service.ts`, `maintenance-fees/maintenance-fee.service.ts`, `payments/payment.service.ts`, `notifications/notification.service.ts`, `contact-edit/contact-edit.service.ts`, `privacy/privacy.service.ts`, `directory/directory.service.ts`

Spec files (8, hardcode URL inside `http.expectOne(...)` calls — no `const API` at top):
- `reservations.service.spec.ts`, `expenses.service.spec.ts`, `financial.service.spec.ts`, `maintenance-fee.service.spec.ts`, `payment.service.spec.ts`, `notification.service.spec.ts`, `contact-edit.service.spec.ts`, `privacy.service.spec.ts`

### Angular build configuration

- Builder: `@angular/build:application` (Vite-based, Angular 21)
- Test runner: `vitest` via `@angular/build:unit-test`
- No `environments/` directory exists yet
- No `fileReplacements` in `angular.json` yet
- Production config: only `budgets` and `outputHashing` — no file replacements

### React build configuration

- CRA (`react-scripts 5.0.1`)
- Supports `REACT_APP_*` env vars injected at build time from `.env.*` files
- No `.env.development` or `.env.production` exist yet
- Test runner: Jest (CRA default)

### Angular spec behavior

Angular specs use `http.expectOne('http://localhost:5000/...')` — hardcoded expected URLs.
These will still pass after refactor because the service will use `environment.apiUrl = 'http://localhost:5000'` in dev/test builds.
**Angular specs do NOT need to be updated.**

### React test behavior

React tests have `const BASE = 'http://localhost:5000'` and check `expect(fetch).toHaveBeenCalledWith(\`${BASE}/...\`)`.
The source file will use `API_BASE = process.env.REACT_APP_API_URL ?? 'http://localhost:5000'`.
In Jest, `process.env.REACT_APP_API_URL` is undefined → `API_BASE = 'http://localhost:5000'`.
The test assertions still match the generated URLs.
**React test files do NOT need to be updated.**

### staticwebapp.config.json

Neither `ui/angular-prototype/staticwebapp.config.json` nor `ui/react-prototype/staticwebapp.config.json` exist.
SPA routing requires a fallback rule (hard-refresh of any client-side route would 404 without it).

### CORS

Already handled in Slice 1: `app.UseCors()` added to `Program.cs` with `Cors:AllowedOrigins` config array.

---

## 2. Risk Indicators

- **Angular `fileReplacements` not yet in `angular.json`** — must be added to production config so `environment.prod.ts` is substituted at build time. If not added, `environment.ts` (localhost) would be used in production builds too.
- **`environment.prod.ts` prod URL not yet known** — Slice 3 provisions the Container App; the actual HTTPS URL is unknown. Use an empty string placeholder. Slice 4 GitHub Actions will inject the real URL via env var or `sed` substitution.
- **React `.env.production`** — CRA picks up `REACT_APP_API_URL` from CI env; no committed `.env.production` needed unless a placeholder is wanted for clarity.
- **Angular spec URL matching** — After refactor, `environment.apiUrl = 'http://localhost:5000'` in dev, so `http.expectOne` calls still match. No risk.
- **Angular import path depth** — All services are at `src/app/<domain>/` depth; import path `../../environments/environment` is consistent across all 9 files.
