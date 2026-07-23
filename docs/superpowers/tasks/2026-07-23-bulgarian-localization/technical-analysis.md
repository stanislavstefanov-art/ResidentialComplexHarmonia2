# Technical Research

**Task**: localization i18n primeng mui household
**Generated**: 2026-07-23T00:00:00Z
**Research path**: filesystem

---

## 1. Original Context

Set Bulgarian as the default language in both Angular (PrimeNG 22) and React (MUI 9) UIs, and update the dev-mode household reference default from "HH-DEV-1" to "АП. 1" in appsettings.json and Program.cs.

Angular localization: configure PrimeNG Bulgarian translations (calendar, dialogs, etc.) via PrimeNGConfig.setTranslation() in app.ts; provide the Bulgarian locale to Angular via LOCALE_ID if needed for date/number formatting.

React localization: add bgBG locale from @mui/material to the createTheme call in App.tsx.

HouseholdRef naming: update Session:HouseholdRef default in src/Harmonia.Api/appsettings.json from "HH-DEV-1" to "АП. 1". Also update the fallback default in Program.cs. Integration test refs (HH-DIR-*, HH-A, etc.) are random test-only identifiers and do NOT need to change - they never appear in real data.

No new packages required for React (bgBG is already in @mui/material). Angular may need @angular/common/locales/bg - check if @angular/common is already installed (it is, it's a core Angular dep).

---

## 2. Codebase Findings

### Existing Implementations

**Angular UI** (`ui/angular/`)

- `src/app/app.ts` (lines 1-47): Root `App` component. Currently only handles MSAL authentication lifecycle (`handleRedirectObservable`, `inProgress$`). No i18n setup present. This is where `PrimeNGConfig.setTranslation()` and `registerLocaleData(localeBg)` calls should be added in `ngOnInit()`.
- `src/app/app.config.ts` (lines 1-74): Angular `ApplicationConfig` with all providers. Contains the `providePrimeNG()` call at lines 67-72, which accepts a `translation` key in its config object (`PrimeNGConfigType` interface). This is the alternative/preferred site for passing Bulgarian translations — no `ngOnInit` hook needed if using the `translation` property of `providePrimeNG`. `LOCALE_ID` provider would also be added to the `providers` array here.
- `src/main.ts` (lines 1-6): Standard `bootstrapApplication(App, appConfig)` bootstrap — no locale setup present.
- `src/app/reservations/reservations.component.ts` (line 10, 27, 55): Imports and uses `DatePicker` from `primeng/datepicker`. The `<p-datepicker>` component at line 55 has `dateFormat="yy-mm-dd"` bound directly — this overrides the PrimeNG global `dateFormat` from the translation config. This attribute will need to be removed or changed to `"dd.mm.yy"` (Bulgarian convention) after the global translation is set, or left as-is if the ISO format is intentional.
- `src/app/directory/directory-list.component.ts` (line 8, 30): Imports `DialogModule` from `primeng/dialog` — dialog close/aria labels will benefit from Bulgarian translation.
- No existing locale files, i18n directories, or translation JSON files anywhere under `ui/angular/src/`.
- `package.json` (line 16): `@angular/common: "^21.2.0"` is listed as a dependency. The `@angular/common/locales/bg` locale file is confirmed present on disk at `node_modules/@angular/common/locales/bg.js`.

**React UI** (`ui/react/`)

- `src/App.tsx` (lines 21-28): Contains the `createTheme()` call with palette, shape, and typography. Currently no locale adapter is passed. The MUI locale adapter is passed as a second (or subsequent) argument to `createTheme()` — e.g., `createTheme({ ... }, bgBG)`.
- `src/index.tsx` (lines 1-24): Standard `ReactDOM.createRoot` with `MsalProvider` wrapping `App`. The `ThemeProvider` wrapping is inside `App.tsx` itself, not here — no changes needed to `index.tsx`.
- `package.json` (line 11): `@mui/material: "^9.2.0"` is the installed version. The `bgBG` locale export is confirmed present on disk at `node_modules/@mui/material/locale/bgBG.js` and `bgBG.d.ts`. No new packages are needed.
- No existing i18n or locale setup anywhere under `ui/react/src/`.

**API / Backend** (`src/Harmonia.Api/`)

- `appsettings.json` (line 21): `"HouseholdRef": "HH-DEV-1"` under the `"Session"` section. This is the only occurrence in committed config files — the development-local override file (`appsettings.Development.local.json`) contains only connection strings.
- `Program.cs` (line 90): `builder.Configuration.GetValue("Session:HouseholdRef", "HH-DEV-1")` — the hardcoded string `"HH-DEV-1"` is the fallback default used when the config key is absent. This is inside the `if (builder.Environment.IsDevelopment())` block (lines 82-91) that wires `DevSession`.

### Architecture and Layers Affected

| Layer | Component | Change |
|---|---|---|
| UI / Presentation — Angular | `app.config.ts` | Add `translation` to `providePrimeNG()` and optionally `LOCALE_ID` provider |
| UI / Presentation — Angular | `app.ts` | Add `registerLocaleData(localeBg)` call (required for Angular pipe formatting with LOCALE_ID) |
| UI / Presentation — React | `App.tsx` | Extend `createTheme()` call with `bgBG` locale adapter |
| Config / Infrastructure — API | `appsettings.json` | Change `HouseholdRef` string value |
| Config / Infrastructure — API | `Program.cs` | Change hardcoded fallback string in `GetValue()` default |

### Integration Points

- **PrimeNG translation mechanism**: `providePrimeNG()` in `app.config.ts` accepts a `translation` key typed as `Translation` (from `primeng/api`). This is the modern PrimeNG 22 approach — passing `translation` here at provider registration time is equivalent to calling `PrimeNG.setTranslation()` imperatively. Both approaches work; the declarative approach in `providePrimeNG` is preferred for standalone Angular apps because it avoids injecting `PrimeNG` service into `App`.
- **Angular LOCALE_ID**: Providing `{ provide: LOCALE_ID, useValue: 'bg' }` in `app.config.ts` enables Angular's built-in pipes (`DatePipe`, `DecimalPipe`, `CurrencyPipe`) to format using Bulgarian conventions. This is separate from PrimeNG translation and requires a `registerLocaleData(localeBg)` call before bootstrapping (or in `app.ts` `ngOnInit`). If Angular pipes are not currently used for date/number formatting anywhere in the Angular app, this step can be deferred, but the `LOCALE_ID` provider costs nothing.
- **MUI locale adapter**: `bgBG` from `@mui/material` is a theme-level object containing Bulgarian `defaultProps` for `MuiBreadcrumbs`, `MuiTablePagination`, `MuiRating`, `MuiAutocomplete`, `MuiAlert`, and `MuiPagination` components. It is passed as a spread argument to `createTheme()` — the MUI v5/v9 API merges it with the base theme object. No `ThemeProvider` changes needed.
- **HouseholdRef value**: The new value `"АП. 1"` contains Cyrillic characters (UTF-8). `appsettings.json` must be saved as UTF-8 (with or without BOM). The .NET `System.Text.Json` / `Microsoft.Extensions.Configuration` JSON config reader handles UTF-8 without BOM by default. The string is used only in `DevSession` (development mode) and flows through the application as a `HouseholdRef` value-object (`HouseholdRef(string Value)`). No database schema changes are required — the existing `HouseholdRef` domain type is an opaque string and imposes no character-set restriction.

### Patterns and Conventions

- Angular uses the standalone component model (`bootstrapApplication` + `appConfig`). All providers are declared in `appConfig` — the correct pattern is to extend the `providers` array in `app.config.ts`, not to create a separate module.
- PrimeNG 22 uses `providePrimeNG()` (not `PrimeNGModule.forRoot()`) — the `translation` option is passed inline as a property of the config object.
- React uses functional component pattern; `createTheme` is called at module scope (line 21 of `App.tsx`) before the component definitions — the `bgBG` locale adapter is added as a second argument to that same call.
- The Angular app does not use `NgModule` — there is no `AppModule` to import into. All configuration is through the `ApplicationConfig` object.

---

## 3. Documentation Findings

### Guides and Architecture Docs

No `.ai-run/guides/` directory exists in the repository. No `docs/` subdirectory contains i18n or localization ADRs. Context is derived from code exploration only.

### Architectural Decisions

- ADR-0001 (identity): `HouseholdRef` is always derived from the verified session — never from request body. The `DevSession` fallback is only active in `IsDevelopment()` mode. Changing the default value from `"HH-DEV-1"` to `"АП. 1"` is a dev-mode-only change and does not affect production identity logic.
- ADR-0002 (store): No store-level impact from this change — `HouseholdRef` is stored as a plain string column; the domain type imposes no format constraint.

### Derived Conventions

- The `providePrimeNG()` call in `app.config.ts` is the single configuration point for all PrimeNG global settings — following the existing pattern, `translation` should be added as a key in the same config object rather than as a separate `PrimeNG.setTranslation()` call.
- The React `createTheme` call is declared at module scope, not inside a component or hook — the `bgBG` adapter should be added at the same level without introducing state or effects.
- Config files use standard .NET JSON configuration layering: `appsettings.json` (base) → `appsettings.Development.json` (environment override) → `appsettings.Development.local.json` (git-ignored local). The `HouseholdRef` key lives in base `appsettings.json` and is not present in the environment-specific files.

---

## 4. Testing Landscape

### Existing Coverage

- Angular: 16 `.spec.ts` files covering all feature components and their services. No spec file tests `app.ts` or `app.config.ts` directly. The `reservations.component.spec.ts` tests slot display and claim button behavior but does not test the DatePicker locale or date format.
- React: Multiple `.test.tsx` files under `ui/react/src/components/` and `ui/react/src/api/`. `App.test.tsx` exists at `ui/react/src/App.test.tsx` — content not read but likely a smoke/render test. No locale-specific tests observed.

### Testing Framework and Patterns

- Angular: Vitest (`"vitest": "^4.1.10"` in devDependencies). Tests use Angular's `TestBed` with stub services (mock service implementations injected directly). Component specs create the component with `TestBed.createComponent()` and assert DOM structure via `querySelector`.
- React: Jest via `react-scripts test` (CRA test setup). `@testing-library/react` is the rendering framework. Tests use `render()` and `screen` queries.

### Coverage Gaps

- No tests exist for `app.config.ts` provider configuration — the `translation` addition to `providePrimeNG` will not be exercised by any existing test. This is expected and acceptable for a configuration-only change.
- No test exists for the Bulgarian locale formatting in either UI — date display format in the PrimeNG `DatePicker` (`dateFormat`) and MUI pagination text will be visually verified rather than test-covered.
- The `HouseholdRef` default change affects only development-mode wiring in `Program.cs` — integration tests that reference specific household refs (e.g., `HH-DIR-*`, `HH-A`) hardcode test-specific values and do not rely on the `Session:HouseholdRef` config default. No integration tests will break.

---

## 5. Configuration and Environment

### Environment Variables

- No environment variables are involved in this change. The `Session:HouseholdRef` value is loaded from JSON config, not from an env var in the current setup.

### Configuration Files

- `src/Harmonia.Api/appsettings.json`: The only file that needs a value change (`"HH-DEV-1"` → `"АП. 1"`). Must be saved as UTF-8 without BOM (standard for .NET JSON config).
- `src/Harmonia.Api/appsettings.Development.local.json`: Contains only `ConnectionStrings` — no `Session` section — no change required.
- `src/Harmonia.Api/appsettings.Development.json`: Contains only `Logging` and `Cors` — no `Session` section — no change required.
- Angular `angular.json` / `tsconfig.json`: No changes needed for the translation approach used (`providePrimeNG` with `translation` property). If `LOCALE_ID` is added and the project is later built with `--localize`, `angular.json` would need a `"locales"` section — but that is a full i18n build configuration, not required here.

### Feature Flags and Deployment Concerns

- The `DevSession` / `DevAdminSession` branching at `Program.cs` lines 82-102 is gated on `builder.Environment.IsDevelopment()`. The `HouseholdRef` default change has zero effect in non-development (staging / production) deployments because `EntraSession` is used there, which derives `HouseholdRef` from the Entra JWT claim.
- No deployment manifests, Docker files, or CI/CD configuration reference `HH-DEV-1` or the `Session:HouseholdRef` key — no changes needed there.
- The Unicode character `А` (Cyrillic) in `"АП. 1"` must survive any text-encoding pipeline: file save, git commit, CI checkout, and Docker image build. All standard tooling on this stack handles UTF-8 correctly. The risk is low but worth confirming the file editor saves without BOM.

---

## 6. Risk Indicators

- **appsettings.json encoding**: The value `"АП. 1"` contains Cyrillic characters. If the file is accidentally saved as UTF-8 with BOM by some Windows editors, .NET's JSON config reader will still parse it correctly (ConfigurationBuilder handles BOM), but it is a deviation from the project norm. Editors like VS Code default to UTF-8 without BOM, which is safe.
- **PrimeNG DatePicker dateFormat override**: `reservations.component.ts` line 58 has `dateFormat="yy-mm-dd"` set directly on the `<p-datepicker>` element. This attribute-level value takes precedence over the global `translation.dateFormat`. After setting Bulgarian translations globally (which would set `dateFormat` to `"dd.mm.yy"`), the component-level `dateFormat="yy-mm-dd"` will still win. The implementer must decide whether to keep ISO format (leave as-is) or align with Bulgarian convention (change to `"dd.mm.yy"` or remove the attribute). This is a scope decision, not a technical blocker.
- **`registerLocaleData` placement**: If `LOCALE_ID` is provided, `registerLocaleData` from `@angular/common` must be called before the locale data is needed. The correct location is either at the top of `main.ts` (before `bootstrapApplication`) or in `app.ts` `ngOnInit`. Forgetting this call while providing `LOCALE_ID` will cause Angular pipe formatting to silently fall back to `en-US` rather than throwing a clear error.
- **PrimeNG translation completeness**: The `Translation` interface in `primeng/api` has approximately 60 optional string fields covering filter labels, calendar navigation, dialog buttons, ARIA labels, etc. A partial Bulgarian translation object (only the most visible fields) is valid TypeScript but will leave some labels in English. This is acceptable for an initial pass.
- **Angular version mismatch in package.json**: `package.json` lists `"@angular/common": "^21.2.0"` but the task context describes this as "Angular (PrimeNG 22)". The actual installed Angular major version is 21, not 22. PrimeNG 22 is compatible with Angular 21. The `bg.js` locale file in `@angular/common@21.x` is confirmed present. No package version risk.
- **No existing i18n test coverage**: Neither UI has any test that asserts localized string content. The translation changes are configuration-only and low-risk, but there is no automated regression path if translations regress.
- **MUI bgBG coverage**: The `bgBG` locale in `@mui/material` covers `MuiBreadcrumbs`, `MuiTablePagination`, `MuiRating`, `MuiAutocomplete`, `MuiAlert`, and `MuiPagination`. MUI date pickers (`@mui/x-date-pickers`) are NOT in use in this project (no `@mui/x-date-pickers` in `package.json`), so date locale is not a concern for the React UI. The coverage provided by `bgBG` is complete for the components the app actually uses.

---

## 7. Summary for Complexity Assessment

This task touches four files across three separate sub-projects (Angular UI, React UI, .NET API) but the changes are all configuration-level with no new business logic. The Angular change involves two files: `app.config.ts` receives a `translation` property added to the existing `providePrimeNG()` call (one block of Bulgarian string literals), and `app.ts` optionally receives a `registerLocaleData(localeBg)` import and call in `ngOnInit`. The React change is a one-line modification to `App.tsx`: importing `bgBG` from `@mui/material` and passing it as the second argument to the existing `createTheme()` call. The API change is two string replacements: `"HH-DEV-1"` to `"АП. 1"` in `appsettings.json` line 21 and `Program.cs` line 90.

The task follows established patterns in all three sub-projects — no new architectural layers, no new packages (all required modules are already installed), and no schema or database changes. The `Translation` interface from PrimeNG is already typed and the `bgBG` export from MUI is already shipped in the installed package versions. The only non-trivial decision is whether the PrimeNG `DatePicker` in `reservations.component.ts` should keep its explicit `dateFormat="yy-mm-dd"` override or adopt the Bulgarian `"dd.mm.yy"` convention; this is a product/UX decision, not a technical one.

Test coverage posture is not a concern for this task: the affected code paths are configuration providers and a dev-mode default value, neither of which has existing test coverage or requires new tests. The sole risk factors are (1) Unicode encoding discipline when editing `appsettings.json`, and (2) completeness of the Bulgarian translation object passed to PrimeNG — both are low-complexity concerns that an implementer can handle in a single focused session. Total file change surface is 4 files, all small, all well-understood.
