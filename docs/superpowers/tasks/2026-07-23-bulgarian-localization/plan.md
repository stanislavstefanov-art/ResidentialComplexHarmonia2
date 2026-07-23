# Bulgarian Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set Bulgarian as the default language in both the Angular (PrimeNG 22) and React (MUI 9) UIs, and update the dev-mode household reference default to `АП. 1`.

**Architecture:** Five targeted edits across three sub-projects — all configuration-level, no new business logic. Angular gets PrimeNG translation + Angular LOCALE_ID + date-format fix; React gets the MUI `bgBG` locale adapter; the API gets two string replacements in the dev session default.

**Tech Stack:** Angular 21 + PrimeNG 22 (`@angular/common/locales/bg`, `LOCALE_ID`), React 19 + MUI 9 (`@mui/material/locale`), .NET 8 Minimal API (`appsettings.json`, `Program.cs`)

---

## File Map

| File | Change |
|------|--------|
| `ui/angular/src/app/app.config.ts` | Add `LOCALE_ID` provider + Bulgarian `translation` object to `providePrimeNG()` |
| `ui/angular/src/app/app.ts` | Add `registerLocaleData(localeBg)` module-level call |
| `ui/angular/src/app/reservations/reservations.component.ts` | Remove `dateFormat="yy-mm-dd"` attribute from `<p-datepicker>` |
| `ui/react/src/App.tsx` | Import `bgBG` from `@mui/material/locale`; pass as second arg to `createTheme()` |
| `src/Harmonia.Api/appsettings.json` | `"HH-DEV-1"` → `"АП. 1"` (line 21) |
| `src/Harmonia.Api/Program.cs` | `"HH-DEV-1"` → `"АП. 1"` in `GetValue()` default (line 90) |

---

### Task 1: Angular — PrimeNG Bulgarian translation + LOCALE_ID

**Test-first:** no — this is a provider configuration change with no existing spec test. Verify with TypeScript build.

**Files:**
- Modify: `ui/angular/src/app/app.config.ts`

- [ ] **Step 1: Open the file and confirm current state**

  Open `ui/angular/src/app/app.config.ts`. Confirm `providePrimeNG()` is at line 67 with only `theme` property inside. Confirm the import line starts with `import { ApplicationConfig, importProvidersFrom, provideBrowserGlobalErrorListeners } from '@angular/core';`.

- [ ] **Step 2: Replace the file with the updated version**

  Replace the entire content of `ui/angular/src/app/app.config.ts` with:

  ```typescript
  import { ApplicationConfig, importProvidersFrom, provideBrowserGlobalErrorListeners, LOCALE_ID } from '@angular/core';
  import { provideRouter } from '@angular/router';
  import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
  import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
  import { providePrimeNG } from 'primeng/config';
  import Aura from '@primeuix/themes/aura';
  import {
    BrowserCacheLocation,
    InteractionType,
    PublicClientApplication,
  } from '@azure/msal-browser';
  import {
    MsalBroadcastService,
    MsalGuard,
    MsalInterceptor,
    MsalModule,
    MsalService,
  } from '@azure/msal-angular';
  import { environment } from '../environments/environment';
  import { routes } from './app.routes';

  const msalInstance = new PublicClientApplication({
    auth: {
      clientId: environment.msal.clientId,
      authority: environment.msal.authority,
      redirectUri: environment.msal.redirectUri,
      postLogoutRedirectUri: environment.msal.postLogoutRedirectUri,
      knownAuthorities: ['residenceharmonia.ciamlogin.com'],
    },
    cache: {
      cacheLocation: BrowserCacheLocation.LocalStorage,
    },
  });

  export const appConfig: ApplicationConfig = {
    providers: [
      provideBrowserGlobalErrorListeners(),
      provideRouter(routes),
      provideAnimationsAsync(),
      // withInterceptorsFromDi() allows class-based interceptors (MsalInterceptor).
      provideHttpClient(withInterceptorsFromDi()),
      {
        provide: HTTP_INTERCEPTORS,
        useClass: MsalInterceptor,
        multi: true,
      },
      importProvidersFrom(
        MsalModule.forRoot(
          msalInstance,
          {
            interactionType: InteractionType.Redirect,
            authRequest: {
              scopes: ['openid', 'profile', 'email'],
            },
          },
          {
            interactionType: InteractionType.Redirect,
            protectedResourceMap: new Map([
              [environment.apiUrl, [environment.msal.apiScope]],
            ]),
          }
        )
      ),
      MsalService,
      MsalGuard,
      MsalBroadcastService,
      { provide: LOCALE_ID, useValue: 'bg' },
      providePrimeNG({
        theme: {
          preset: Aura,
          options: { darkModeSelector: false },
        },
        translation: {
          firstDayOfWeek: 1,
          dayNames: ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота'],
          dayNamesShort: ['Нед', 'Пон', 'Вт', 'Ср', 'Чет', 'Пет', 'Съб'],
          dayNamesMin: ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
          monthNames: ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'],
          monthNamesShort: ['Яну', 'Фев', 'Мар', 'Апр', 'Май', 'Юни', 'Юли', 'Авг', 'Сеп', 'Окт', 'Ное', 'Дек'],
          today: 'Днес',
          clear: 'Изчисти',
          weekHeader: 'Сед',
          dateFormat: 'dd.mm.yy',
          accept: 'Да',
          reject: 'Не',
          choose: 'Избери',
          upload: 'Качи',
          cancel: 'Отказ',
          fileSizeTypes: ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
          aria: {
            trueLabel: 'Вярно',
            falseLabel: 'Невярно',
            nullLabel: 'Не е избрано',
            star: '1 звезда',
            stars: '{0} звезди',
            selectAll: 'Избери всички',
            unselectAll: 'Премахни всички',
            close: 'Затвори',
            previous: 'Предишен',
            next: 'Следващ',
            navigation: 'Навигация',
            scrollTop: 'Нагоре',
            moveTop: 'Премести най-горе',
            moveUp: 'Премести нагоре',
            moveDown: 'Премести надолу',
            moveBottom: 'Премести най-долу',
            moveToTarget: 'Премести към целта',
            moveToSource: 'Премести към източника',
            moveAllToTarget: 'Премести всички към целта',
            moveAllToSource: 'Премести всички към източника',
            pageLabel: 'Страница {page}',
            firstPageLabel: 'Първа страница',
            lastPageLabel: 'Последна страница',
            nextPageLabel: 'Следваща страница',
            previousPageLabel: 'Предишна страница',
            rowsPerPageLabel: 'Редове на страница',
            jumpToPageDropdownLabel: 'Отиди на страница',
            jumpToPageInputLabel: 'Отиди на страница',
            selectRow: 'Избери ред',
            unselectRow: 'Премахни ред',
            expandRow: 'Разшири ред',
            collapseRow: 'Свий ред',
            showFilterMenu: 'Покажи филтри',
            hideFilterMenu: 'Скрий филтри',
            filterOperator: 'Оператор на филтър',
            filterConstraint: 'Ограничение на филтър',
            editRow: 'Редактирай ред',
            saveEdit: 'Запази',
            cancelEdit: 'Отказ',
            listView: 'Изглед на списък',
            gridView: 'Мрежов изглед',
            slide: 'Слайд',
            slideNumber: 'Слайд {slideNumber}',
            zoomImage: 'Увеличи изображение',
            zoomIn: 'Увеличи',
            zoomOut: 'Намали',
            rotateRight: 'Завърти надясно',
            rotateLeft: 'Завърти наляво',
          },
        },
      }),
    ],
  };
  ```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

  Run from `ui/angular/`:
  ```bash
  npx tsc --noEmit
  ```
  Expected: no output (zero errors). If you see `Property 'translation' does not exist`, check that your `primeng` version is 22.x — `providePrimeNG` accepted `translation` from PrimeNG 17+.

- [ ] **Step 4: Commit**

  ```bash
  git add ui/angular/src/app/app.config.ts
  git commit -m "feat(angular): add PrimeNG Bulgarian translation and LOCALE_ID provider"
  ```

---

### Task 2: Angular — register locale data (`app.ts`)

**Test-first:** no — side-effect registration; verified by correct pipe output at runtime.

**Files:**
- Modify: `ui/angular/src/app/app.ts`

- [ ] **Step 1: Add locale imports and registration call**

  Replace the entire content of `ui/angular/src/app/app.ts` with:

  ```typescript
  import { Component, OnInit, OnDestroy } from '@angular/core';
  import { RouterOutlet } from '@angular/router';
  import { MsalBroadcastService, MsalService } from '@azure/msal-angular';
  import { InteractionStatus } from '@azure/msal-browser';
  import { Subject } from 'rxjs';
  import { filter, takeUntil } from 'rxjs/operators';
  import { registerLocaleData } from '@angular/common';
  import localeBg from '@angular/common/locales/bg';

  registerLocaleData(localeBg);

  @Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    // MsalRedirectComponent is rendered in a hidden iframe for redirect flows;
    // the guard redirects back here once authentication completes.
    template: `<router-outlet />`,
  })
  export class App implements OnInit, OnDestroy {
    private readonly _destroying$ = new Subject<void>();

    constructor(
      private readonly authService: MsalService,
      private readonly broadcastService: MsalBroadcastService
    ) {}

    ngOnInit(): void {
      // Must be called in every component that uses redirects so MSAL can
      // process the authorization response on the redirect return.
      this.authService.handleRedirectObservable().subscribe();

      // Once all in-progress interactions complete, ensure an active account is
      // set so acquireTokenSilent knows which account to use.
      this.broadcastService.inProgress$
        .pipe(
          filter((status) => status === InteractionStatus.None),
          takeUntil(this._destroying$)
        )
        .subscribe(() => {
          const accounts = this.authService.instance.getAllAccounts();
          if (accounts.length > 0 && !this.authService.instance.getActiveAccount()) {
            this.authService.instance.setActiveAccount(accounts[0]);
          }
        });
    }

    ngOnDestroy(): void {
      this._destroying$.next(undefined);
      this._destroying$.complete();
    }
  }
  ```

  The two new lines are the `registerLocaleData` import and the module-level call immediately before the `@Component` decorator. The `localeBg` default import resolves to `node_modules/@angular/common/locales/bg.js` — no installation needed.

- [ ] **Step 2: Verify TypeScript compiles cleanly**

  Run from `ui/angular/`:
  ```bash
  npx tsc --noEmit
  ```
  Expected: no output. If you see `Cannot find module '@angular/common/locales/bg'`, confirm `@angular/common` is installed: `ls node_modules/@angular/common/locales/bg.js` should print the path.

- [ ] **Step 3: Commit**

  ```bash
  git add ui/angular/src/app/app.ts
  git commit -m "feat(angular): register Bulgarian locale data for Angular pipes"
  ```

---

### Task 3: Angular — remove date format override (`reservations.component.ts`)

**Test-first:** no — template attribute removal; verified by visual inspection in browser.

**Files:**
- Modify: `ui/angular/src/app/reservations/reservations.component.ts`

- [ ] **Step 1: Remove the `dateFormat` attribute**

  In `ui/angular/src/app/reservations/reservations.component.ts`, find the `<p-datepicker>` block (currently lines 55–61):

  ```html
  <p-datepicker
    [(ngModel)]="selectedDate"
    [minDate]="today"
    dateFormat="yy-mm-dd"
    [showIcon]="true"
    (ngModelChange)="onDateChange($event)"
  />
  ```

  Remove the `dateFormat="yy-mm-dd"` line so the block becomes:

  ```html
  <p-datepicker
    [(ngModel)]="selectedDate"
    [minDate]="today"
    [showIcon]="true"
    (ngModelChange)="onDateChange($event)"
  />
  ```

  The global `translation.dateFormat: 'dd.mm.yy'` set in Task 1 now applies.

- [ ] **Step 2: Verify build succeeds**

  Run from `ui/angular/`:
  ```bash
  npm run build
  ```
  Expected: `Build at: ... - Hash: ... - Time: ...ms` with no errors. The `dist/harmonia-angular/browser/` directory is updated.

- [ ] **Step 3: Commit**

  ```bash
  git add ui/angular/src/app/reservations/reservations.component.ts
  git commit -m "feat(angular): use Bulgarian date format (dd.mm.yy) in reservation picker"
  ```

---

### Task 4: React — MUI Bulgarian locale adapter (`App.tsx`)

**Test-first:** no — theme-level config; verified by build + visual check of MUI component strings.

**Files:**
- Modify: `ui/react/src/App.tsx`

- [ ] **Step 1: Add the `bgBG` import**

  In `ui/react/src/App.tsx`, add `{ bgBG }` to the imports from `@mui/material/locale`. Add it after the existing MUI imports (line 6). The block currently ends with:

  ```typescript
  import HomeIcon from '@mui/icons-material/Home';
  ```

  Add one line after it:

  ```typescript
  import { bgBG } from '@mui/material/locale';
  ```

- [ ] **Step 2: Pass `bgBG` to `createTheme()`**

  Find the `createTheme` call (currently lines 21–28):

  ```typescript
  const theme = createTheme({
    palette: {
      primary: { main: '#2e6b4f' },
      background: { default: '#f5f5f0' },
    },
    shape: { borderRadius: 8 },
    typography: { fontFamily: 'system-ui, -apple-system, sans-serif' },
  });
  ```

  Replace it with:

  ```typescript
  const theme = createTheme(
    {
      palette: {
        primary: { main: '#2e6b4f' },
        background: { default: '#f5f5f0' },
      },
      shape: { borderRadius: 8 },
      typography: { fontFamily: 'system-ui, -apple-system, sans-serif' },
    },
    bgBG,
  );
  ```

  `bgBG` is a theme-level locale object. MUI's `createTheme` merges it with the base options. It covers Bulgarian strings for `MuiBreadcrumbs`, `MuiTablePagination`, `MuiRating`, `MuiAutocomplete`, `MuiAlert`, and `MuiPagination`.

- [ ] **Step 3: Verify TypeScript compiles cleanly**

  Run from `ui/react/`:
  ```bash
  npx tsc --noEmit
  ```
  Expected: no output. If you see an error about `bgBG`, confirm the import path is `@mui/material/locale` (not `@mui/material`) and that `@mui/material` version is `^9.x`.

- [ ] **Step 4: Verify build succeeds**

  Run from `ui/react/`:
  ```bash
  npm run build
  ```
  Expected: `Compiled successfully.` with the `build/` directory updated. Ignore pre-existing `node_modules/@mui/x-internals` type warnings — they are unrelated to this change.

- [ ] **Step 5: Commit**

  ```bash
  git add ui/react/src/App.tsx
  git commit -m "feat(react): add MUI Bulgarian locale adapter (bgBG)"
  ```

---

### Task 5: API — update household ref default

**Test-first:** no — string value in config + fallback default; no integration test references `HH-DEV-1`.

**Files:**
- Modify: `src/Harmonia.Api/appsettings.json` (line 21)
- Modify: `src/Harmonia.Api/Program.cs` (line 90)

- [ ] **Step 1: Update `appsettings.json`**

  In `src/Harmonia.Api/appsettings.json`, find line 21:

  ```json
  "HouseholdRef": "HH-DEV-1"
  ```

  Change it to:

  ```json
  "HouseholdRef": "АП. 1"
  ```

  Save the file as **UTF-8 without BOM** (VS Code default; verify in the bottom-right status bar — it should say `UTF-8`, not `UTF-8 with BOM`).

  The full `Session` section after the change:
  ```json
  "Session": {
    "IsResident": true,
    "HouseholdRef": "АП. 1"
  },
  ```

- [ ] **Step 2: Update `Program.cs`**

  In `src/Harmonia.Api/Program.cs`, find line 90:

  ```csharp
  builder.Configuration.GetValue("Session:HouseholdRef", "HH-DEV-1")!));
  ```

  Change it to:

  ```csharp
  builder.Configuration.GetValue("Session:HouseholdRef", "АП. 1")!));
  ```

  The full `DevSession` registration block after the change (lines 88–91):

  ```csharp
      else
          builder.Services.AddSingleton<ISession>(new DevSession(
              builder.Configuration.GetValue("Session:IsResident", true),
              builder.Configuration.GetValue("Session:HouseholdRef", "АП. 1")!));
  ```

- [ ] **Step 3: Verify the API builds**

  Run from the repository root:
  ```bash
  dotnet build src/Harmonia.Api/Harmonia.Api.csproj
  ```
  Expected: `Build succeeded.` with zero warnings about the changed lines. If you see a `CS8604` nullable warning, confirm the `!` null-forgiving operator is still present after `"АП. 1")`.

- [ ] **Step 4: Commit**

  ```bash
  git add src/Harmonia.Api/appsettings.json src/Harmonia.Api/Program.cs
  git commit -m "feat(api): update dev session household ref default to АП. 1"
  ```

---

## Verification Checklist

After all five tasks are committed, run the full build for each sub-project to confirm nothing regressed:

```bash
# Angular
cd ui/angular && npm run build

# React
cd ui/react && npm run build

# API
dotnet build src/Harmonia.Api/Harmonia.Api.csproj
```

Then start each app locally and verify:

1. **Angular** — Open `http://localhost:4200`, navigate to BBQ Reservations, open the date picker. Confirm months are in Bulgarian (`Януари`, `Февруари`, …), the week starts on Monday (`Пн`), and the date shows in `dd.mm.yy` format.
2. **React** — Open `http://localhost:3000`, navigate to any screen with pagination. Confirm MUI Pagination shows `Редове на страница` instead of `Rows per page`.
3. **API** — Start the API in Development mode. A `GET /directory` call (with dev session) should return data for household `АП. 1`.
