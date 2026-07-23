# Technical Research

**Task**: gdpr directory ui angular react
**Generated**: 2026-07-22T00:00:00Z
**Research path**: filesystem

---

## 1. Original Context

GDPR self-service erasure UI — add a 'Delete my data' action in the resident's My Profile flow (calls DELETE /directory/contact) and an 'Erase contact' action in the admin directory row (calls DELETE /directory/{householdRef}/contact). Same feature in both Angular (ui/angular-prototype/) and React (ui/react-prototype/). No new API endpoints needed — backend is fully implemented across GDPR slices 1–3. Resident can erase only their own data; admin can erase any resident's data. Both actions need a confirmation step before calling the API.

---

## 2. Codebase Findings

### Existing Implementations

**React — API layer**

- `ui/react-prototype/src/api/directory.ts` — exports `getDirectory`, `getAdminDirectory`, `updateMyContact`, `adminUpdateContact`, `markDeparted`. Does NOT contain `eraseMyContact` or `eraseContact`. These two functions already exist in `ui/react-prototype/src/api/privacy.ts` and must be imported from there (or re-exported to `directory.ts`) for use in the directory flow.
- `ui/react-prototype/src/api/privacy.ts` — exports `eraseMyContact()` (DELETE /directory/contact), `eraseContact(householdRef)` (DELETE /directory/{ref}/contact → returns `'erased' | 'not-found'`), `markDeparted`, `purgeExpired`. Both erase functions are fully implemented and tested.

**React — Component layer**

- `ui/react-prototype/src/components/DirectoryList.tsx` — main directory component (MUI DataGrid). Supports `role: Role` prop. Resident view shows "My Profile" button that opens `EditContactDialog`. Admin view shows a DataGrid with action column containing Edit (`EditIcon`) and Mark Departed (`PersonOffIcon`) icon buttons per row. Three dialogs are already integrated: `EditContactDialog`, `AdminEditDialog`, `MarkDepartedDialog`.
- `ui/react-prototype/src/components/EditContactDialog.tsx` — MUI Dialog for resident "My Profile" edit. Props: `open, saving, form: MyContact, onChange, onSave, onClose`. Contains DisplayName / Phone / Email fields and a `Switch` for opt-out. No erase action present.
- `ui/react-prototype/src/components/AdminEditDialog.tsx` — MUI Dialog for admin editing a resident. Props: `open, saving, householdRef, form: AdminContact, onChange, onSave, onClose`. No erase action present.
- `ui/react-prototype/src/components/MarkDepartedDialog.tsx` — MUI confirmation dialog (the exact pattern to copy for erase confirmations). Props: `open, householdRef, departing: boolean, onConfirm, onClose`. Uses `Dialog > DialogTitle > DialogContent > DialogContentText > DialogActions` with Cancel and destructive action buttons. The in-progress state disables `onClose` and shows `CircularProgress` in the action button.
- `ui/react-prototype/src/components/PrivacyScreen.tsx` — standalone screen that already implements "Delete My Data" (resident) and "Erase Contact" (admin, with householdRef text input). These are implemented without a confirmation step; they call the API directly on button click. This screen is not integrated into the directory flow.

**React — Types**

- `ui/react-prototype/src/types/index.ts` — `DirectoryEntry`, `DirectoryEntryAdmin`, `MyContact`, `AdminContact`, `UpdateContactRequest`, `AdminUpdateContactRequest`, `Role`. No erase-specific types needed (API functions return `'erased' | 'not-found'` string literals).

**Angular — Service layer**

- `ui/angular-prototype/src/app/directory/directory.service.ts` — `DirectoryService` with `HttpClient`. Methods: `getDirectory`, `getAdminDirectory`, `updateMyContact`, `adminUpdateContact`, `markDeparted`. Does NOT contain `eraseMyContact` or `eraseContact`.
- `ui/angular-prototype/src/app/privacy/privacy.service.ts` — `PrivacyService` with `eraseMyContact()` (DELETE /directory/contact), `eraseContact(householdRef)` (DELETE /directory/{ref}/contact → Observable<`'erased' | 'not-found'`>), `markDeparted`, `purgeExpired`. Uses `catchError` to convert 404 to `'not-found'` outcome. Both erase methods are fully implemented and tested.

**Angular — Component layer**

- `ui/angular-prototype/src/app/directory/directory-list.component.ts` — large inline-template standalone component (PrimeNG). Supports resident/admin role toggle. Resident "My Profile" opens an inline `p-dialog`. Admin table has action column with Edit and "Mark Departed" buttons. Three inline `p-dialog` blocks already implemented: resident edit, admin edit, and Mark Departed confirm dialog. No erase functionality present.
- `ui/angular-prototype/src/app/privacy/privacy.component.ts` — standalone screen (separate route `/privacy`). Already implements: "Delete My Contact Data" (resident, no confirmation), "DSAR Contact Erasure" (admin, householdRef text input + button, no confirmation), "Mark Household as Departed" (admin), "Annual Retention Sweep" (admin). Injects `PrivacyService`.
- `ui/angular-prototype/src/app/contact-edit/contact-edit.component.ts` — standalone contact edit screen at `/contact-edit` route. Handles resident update and admin update/notes. No erase actions.

**Angular — Models**

- `ui/angular-prototype/src/app/directory/models.ts` — mirrors React types: `DirectoryEntry`, `DirectoryEntryAdmin`, `MyContact`, `AdminContact`, `UpdateContactRequest`, `AdminUpdateContactRequest`.
- `ui/angular-prototype/src/app/privacy/models.ts` — `EraseContactOutcome = 'erased' | 'not-found'`, `MarkDepartedOutcome = 'ok' | 'not-found'`, `PurgeExpiredResult { deleted: number }`.

### Architecture and Layers Affected

The task is purely a UI layer change. No backend, no API routes, no domain logic changes. Two parallel UI codebases are affected:

**React layer** (`ui/react-prototype/src/`)
- `api/directory.ts` — add `eraseMyContact` and `eraseContact` functions (or import from `api/privacy.ts`)
- `components/DirectoryList.tsx` — add erase state variables, handlers, and two new dialog instantiations
- `components/EditContactDialog.tsx` — add "Delete my data" button/section (resident erase confirmation trigger)
- `components/AdminEditDialog.tsx` — add "Erase contact" button (admin erase confirmation trigger) OR add to admin action column
- New file: `components/EraseContactDialog.tsx` (confirmation dialog, modelled on `MarkDepartedDialog`)

**Angular layer** (`ui/angular-prototype/src/app/`)
- `directory/directory.service.ts` — add `eraseMyContact()` and `eraseContact(householdRef)` methods (or inject `PrivacyService` into the directory component)
- `directory/directory-list.component.ts` — add erase signals/state, handlers, and two new `p-dialog` blocks (resident erase confirmation, admin erase confirmation)

### Integration Points

- Both erase API calls already exist in the `privacy` API module / `PrivacyService`. The implementation must decide whether to:
  - (A) Import/inject from the existing privacy module into the directory component — avoids duplication but creates a cross-module dependency from `directory` to `privacy`.
  - (B) Add new methods to `directory.ts` / `DirectoryService` that repeat the same HTTP calls — avoids cross-module dependency, keeps directory self-contained.
  Option B is the lower-risk choice given the directory component is already self-contained and does not import from `privacy`.
- `MarkDepartedDialog` (React) / the Mark Departed `p-dialog` block (Angular) are the exact templates for the two new confirmation dialogs. The pattern is: a boolean `open` state, a `householdRef` string state, a boolean `in-progress` state, an `onConfirm` handler that calls the API and updates local state, and a `onClose` handler.
- MUI component imports needed in React: `Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, CircularProgress` — all already imported in `MarkDepartedDialog.tsx`.
- PrimeNG imports needed in Angular: `DialogModule, ButtonModule` — both already declared in `DirectoryListComponent.imports`.

### Patterns and Conventions

**React confirmation dialog pattern (from MarkDepartedDialog.tsx):**
```
Props: { open, householdRef, <inProgress>: boolean, onConfirm, onClose }
<Dialog open={open} onClose={inProgress ? undefined : onClose} maxWidth="xs" fullWidth>
  <DialogTitle>…?</DialogTitle>
  <DialogContent><DialogContentText>…</DialogContentText></DialogContent>
  <DialogActions>
    <Button onClick={onClose} color="inherit" disabled={inProgress}>Cancel</Button>
    <Button onClick={onConfirm} variant="contained" color="error" disabled={inProgress}
            startIcon={inProgress ? <CircularProgress size={16} color="inherit" /> : undefined}>
      {inProgress ? '…ing…' : 'Action Label'}
    </Button>
  </DialogActions>
</Dialog>
```

**Angular confirmation dialog pattern (from directory-list.component.ts Mark Departed block):**
```
<p-dialog [(visible)]="<visibleFlag>" header="…?" [modal]="true"
          [style]="{ width: '28rem' }" [draggable]="false" [resizable]="false"
          [closable]="!<inProgress()>">
  <p class="depart-message">…<strong>{{ ref }}</strong>…</p>
  <ng-template #footer>
    <p-button label="Cancel" severity="secondary" [outlined]="true"
              [disabled]="<inProgress()>" (onClick)="<visibleFlag> = false" />
    <p-button label="Action Label" severity="danger" [loading]="<inProgress()>"
              (onClick)="confirmMethod()" />
  </ng-template>
</p-dialog>
```

**Angular signal pattern for boolean in-progress state:**
```typescript
readonly <erasing> = signal(false);
<erasing>.set(true); // before API call
<erasing>.set(false); // in next/error callback
```

**React state management pattern in DirectoryList.tsx:** each dialog has three pieces of state — `<name>Open: boolean`, `<name>Ref: string`, `<name>InProgress: boolean` — plus a handler that calls the API, updates local rows on success, and calls `showToast`.

**API call pattern in directory.ts (React):** plain `fetch` with `{ method: 'DELETE' }`, status code check, error throw on non-OK (except 404 which becomes a string outcome).

**DirectoryService (Angular):** `HttpClient.delete()` with `{ responseType: 'text' }` piped through `map(() => undefined)` for void returns, or `catchError` for 404 disambiguation (same pattern as `PrivacyService`).

---

## 3. Documentation Findings

### Guides and Architecture Docs

No `.ai-run/guides/` directory found. No explicit UI architecture guide found. Conventions are derived from the existing codebase.

The prior GDPR slice analysis at `docs/superpowers/tasks/2026-07-16-gdpr-erasure-slice2/technical-analysis.md` documents the backend implementation (API endpoints, use cases, domain model). The backend DELETE /directory/contact and DELETE /directory/{householdRef}/contact endpoints are confirmed fully implemented.

### Architectural Decisions

- ADR-0001 (R2): `householdRef` for admin operations must come from the UI selecting the row (not from a text field the user types into). The directory admin table already knows each row's `householdRef` — the erase action should capture it from the row, exactly as `openDepart` / `openDepartConfirm` does for the Mark Departed action.
- ADR-0003 (R3): `householdRef` must not be logged. The UI does not log, so this is N/A for the front end.
- The prior analysis confirms: DELETE /directory/contact (resident self-erase) returns 204 on success. DELETE /directory/{ref}/contact (admin erase) returns 204 on success, 404 if not found.

### Derived Conventions

- The directory component is the correct location for the new erase actions (not the separate privacy screen) because the task explicitly says "My Profile flow" and "admin directory row".
- The resident "Delete my data" action belongs inside `EditContactDialog` (React) / the resident `p-dialog` (Angular), or as a secondary button next to the "My Profile" button, consistent with the "My Profile flow" framing.
- The admin "Erase contact" action belongs in the admin table's action column, alongside the existing Edit and Mark Departed icon buttons.
- Confirmation dialogs must block dismissal while the API call is in flight (the `onClose={inProgress ? undefined : onClose}` React pattern and `[closable]="!departing()"` Angular pattern both do this).
- Toast/success notification on completion follows the existing `showToast` (React) / `this.msg.add(...)` (Angular) patterns.
- After a successful erase, the row should be removed from `adminRows` (React) / `adminEntries` signal (Angular) immediately, consistent with how `handleDepart` removes the departed row without a reload.

---

## 4. Testing Landscape

### Existing Coverage

**React:**
- `ui/react-prototype/src/api/privacy.test.ts` — 6 tests covering `eraseMyContact`, `eraseContact` (204/404), `markDeparted` (200/404), `purgeExpired`. These cover the API functions the new feature will use.
- `ui/react-prototype/src/components/PrivacyScreen.test.tsx` — 8 tests covering the existing Privacy screen (delete-my-data button, erase form, depart form, purge button). Uses `jest.mock('../api/privacy')`, `@testing-library/react`, `ThemeProvider` wrapper.
- No test file exists for `DirectoryList.tsx`, `EditContactDialog.tsx`, `AdminEditDialog.tsx`, or `MarkDepartedDialog.tsx`.

**Angular:**
- `ui/angular-prototype/src/app/privacy/privacy.component.spec.ts` — 8 tests covering `PrivacyComponent` (Vitest + TestBed, service mock via `useValue`, `data-testid` selectors). Tests: show/hide resident vs admin views, `onDeleteMyData`, `onEraseContact`, `onMarkDeparted` (ok + not-found), `onPurgeExpired`.
- `ui/angular-prototype/src/app/privacy/privacy.service.spec.ts` — exists (not read, but file is present).
- No test file exists for `directory-list.component.ts` or `directory.service.ts`.

### Testing Framework and Patterns

**React:** Jest + `@testing-library/react`. Pattern: `jest.mock('../api/<module>')`, cast mocks as `jest.Mock`, `beforeEach` sets defaults, `render` with `ThemeProvider` wrapper, `fireEvent`/`waitFor` for async, `data-testid` attribute selectors. Files: `*.test.tsx` or `*.test.ts`.

**Angular:** Vitest + Angular `TestBed`. Pattern: `TestBed.configureTestingModule` with `provideRouter([])`, `provideHttpClient()`, `provideHttpClientTesting()`, `{ provide: ServiceClass, useValue: mockObject }`. Component state set directly via `fixture.componentInstance.<property>`. `fixture.detectChanges()` + `await fixture.whenStable()` + `fixture.detectChanges()` for async flush. `vi.fn().mockReturnValue(of(...))` for Observable mocks. Files: `*.component.spec.ts`.

### Coverage Gaps

All new code in this task has no existing test coverage:

**React:**
- `DirectoryList.tsx` new erase state and handlers — no component test file exists; one must be created as `DirectoryList.test.tsx` or the erase logic can be tested via the new dialog component tests.
- New `EraseContactDialog.tsx` (if extracted as a separate file) — no test file.
- `api/directory.ts` additions (`eraseMyContact`, `eraseContact`) — `api/directory.test.ts` does not currently exist (no file found in glob results); a new test file is needed.

**Angular:**
- `directory-list.component.ts` new erase signals and handlers — no spec file exists; one must be created as `directory-list.component.spec.ts`.
- `directory.service.ts` additions (`eraseMyContact`, `eraseContact`) — `directory.service.spec.ts` does not exist.

---

## 5. Configuration and Environment

### Environment Variables

- `API_BASE` in React (`ui/react-prototype/src/api/config.ts`) — hardcoded to `http://localhost:5000`. No environment variable.
- `environment.apiUrl` in Angular (`ui/angular-prototype/src/environments/environment.ts`) — sets base URL for `HttpClient` calls. No new configuration needed.

### Configuration Files

- `ui/react-prototype/src/api/config.ts` — exports `API_BASE = 'http://localhost:5000'`. No change needed.
- `ui/angular-prototype/src/environments/environment.ts` — no change needed.

### Feature Flags and Deployment Concerns

- No feature flags exist in either UI codebase.
- No new routes or lazy-loaded modules needed; both UIs use a single-page layout.
- The task is purely additive UI state + dialog code — no build configuration changes needed.

---

## 6. Risk Indicators

- **No existing erase functions in `directory.ts` / `DirectoryService`** — the implementation must either add new functions to these files (recommended, avoids cross-module coupling) or import from `privacy.ts` / inject `PrivacyService`. A decision must be made before starting; the task context does not specify.
- **React `DirectoryList.tsx` is already large** (400+ lines including state, handlers, columns, dialogs). Adding two more dialogs (erase resident + erase admin) will make it significantly longer. Extracting the new `EraseContactDialog` as its own file (mirroring `MarkDepartedDialog.tsx`) is the established pattern.
- **No existing test file for `DirectoryList.tsx`** — the primary component being modified has zero test coverage. New tests will need to bootstrap from scratch (no existing spec to extend).
- **Angular `directory-list.component.ts` uses inline templates** — both the resident edit dialog, admin edit dialog, and Mark Departed confirm dialog are all inline in a single file (571 lines). Adding two more dialogs inline will make the file very long. The existing pattern must be followed (inline), as extracting to separate components would require a larger refactor beyond this task scope.
- **Admin erase action placement ambiguity** — the task says "admin directory row". The admin action column currently has 88px width with two icon buttons (Edit, Mark Departed). A third icon button (`DeleteIcon` or `EraseIcon`) can fit, but the column width may need to increase. For Angular, the action cell `<div class="action-cell">` also has two buttons; a third is straightforward.
- **Resident erase UX ambiguity** — the task says "My Profile flow". `EditContactDialog` / the resident `p-dialog` is the My Profile flow. Placing "Delete my data" inside an edit dialog is an unusual UX (mixing edit and destructive erase in one dialog). An alternative is a separate "Delete my data" button next to the existing "My Profile" button in the header. This is a design decision that should be confirmed before implementation.
- **Confirmation dialog for resident erase** — the resident erase calls DELETE /directory/contact (no householdRef argument). The confirmation dialog does not need to show a `householdRef` value, unlike `MarkDepartedDialog`. The copy should reference "your contact data" instead.
- **Post-erase UI state for resident** — after a resident erases their own data, the directory list still shows other residents. The resident's own row is not explicitly visible in the resident view (the directory shows other residents, not self). No row removal is needed for the resident erase; a toast/success message is sufficient.
- **`eraseContact` returns `'erased' | 'not-found'`** — the admin erase must handle the `'not-found'` case (show an error/info toast). This is already handled in `PrivacyScreen` and the Angular `PrivacyComponent` and must be replicated in the directory handlers.
- **React `PrivacyScreen` and Angular `PrivacyComponent` implement erase without confirmation** — the existing screens call the API directly. The task requires a confirmation step. The new implementations in the directory flow must add this step; the Privacy screens are NOT being updated (they are separate screens, not covered by this task).
- **No `data-testid` attributes on `DirectoryList.tsx` elements** — unlike `PrivacyScreen` and `ContactEditScreen`, the existing `DirectoryList.tsx` has no `data-testid` attributes. New erase-related elements should add `data-testid` for testability, following the convention established in other screens.

---

## 7. Summary for Complexity Assessment

This task is a pure UI addition touching two independent frontend codebases (React + Angular). The backend is complete — no API, domain, or infrastructure changes are required. The file change surface is modest: in React, the primary changes are to `DirectoryList.tsx` (new state, handlers, dialog instantiations), a new `EraseContactDialog.tsx` (confirmation dialog), and additions to `api/directory.ts` (two DELETE functions). In Angular, the changes are to `directory-list.component.ts` (new signals, handlers, two inline `p-dialog` blocks) and `directory.service.ts` (two new Observable methods). Total estimated file changes: 4–6 files across both apps, plus 2–4 new test files.

The technical novelty is low. Every pattern required already exists in the same files being modified. The React confirmation dialog pattern is fully established in `MarkDepartedDialog.tsx` — copy, adjust text and API call, done. The Angular inline confirmation dialog pattern is established in `directory-list.component.ts` (the Mark Departed `p-dialog` block). The API functions exist in `privacy.ts` / `PrivacyService` and need to be mirrored or imported. The only judgment call is whether to add the erase functions to the `directory` module or import from `privacy` — the former is recommended for consistency with how `markDeparted` is handled (it lives in `directory.ts` in React but in `privacy.service.ts` in Angular, an existing asymmetry).

Test coverage posture is mixed: the API functions being called are well-tested in `privacy.test.ts` and `privacy.service.spec.ts`, but neither the React `DirectoryList.tsx` component nor the Angular `DirectoryListComponent` has any existing test file. New test files must be created from scratch. The Angular testing pattern (TestBed + Vitest, service mocked via `useValue`) and React testing pattern (Jest + RTL, API module mocked via `jest.mock`) are both well-established in adjacent test files and can be copied as a starting template. Key risk factors: (1) UX placement of resident erase — inside `EditContactDialog` vs separate button requires a design decision; (2) the admin action column width may need adjustment to fit a third icon button; (3) the large inline component in Angular will become even longer, but this is a pre-existing pattern constraint, not a new risk.
