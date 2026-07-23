# GDPR Self-Service Erasure UI

**Status:** Approved
**Branch:** feat/gdpr-erasure-ui

---

## Goal

Expose the fully-implemented GDPR Art. 17 erasure backend to users in both UIs:
- Residents can permanently delete their own contact data from within the "My Profile" dialog.
- Admins can permanently erase any resident's contact data from the admin directory row.

---

## Scope

Four files changed. No new API endpoints, services (beyond `DirectoryService` additions), or schema changes.

| File | Change |
|------|--------|
| `ui/react-prototype/src/components/EraseMyContactDialog.tsx` | **Create** — resident self-erase confirmation dialog |
| `ui/react-prototype/src/components/EraseContactDialog.tsx` | **Create** — admin erase confirmation dialog |
| `ui/react-prototype/src/components/EditContactDialog.tsx` | Add `onRequestErase` prop + "Delete my data" button in footer |
| `ui/react-prototype/src/components/DirectoryList.tsx` | Wire both erase flows (state, handlers, action column icon, dialog renders) |
| `ui/angular-prototype/src/app/directory/directory.service.ts` | Add `eraseMyContact()` and `eraseContact(householdRef)` |
| `ui/angular-prototype/src/app/directory/directory-list.component.ts` | Wire both erase flows (signals, handlers, dialogs, action column button) |

---

## Resident erase flow

1. Resident opens "My Profile" dialog.
2. A "Delete my data" button (outlined, `color="error"` / `severity="danger"`) appears in the footer alongside Cancel and Save.
3. Clicking it opens `EraseMyContactDialog` — a confirmation dialog explaining the action is permanent.
4. Confirming calls `eraseMyContact()` (already in `privacy.ts` / to be added to `DirectoryService`).
5. On success: close both dialogs, show success toast, reload the directory (resident's entry is gone).
6. On error: show error alert inside the confirmation dialog; keep it open.

---

## Admin erase flow

1. Admin sees a third icon button (trash/delete, `severity="danger"`) in the action column of each row, alongside the existing Edit and Mark Departed icons.
2. Clicking it opens `EraseContactDialog` — a confirmation dialog showing the apartment ref and warning permanence.
3. Confirming calls `eraseContact(householdRef)` (already in `privacy.ts` / to be added to `DirectoryService`).
4. On success: close dialog, remove the row from `adminEntries` locally (same pattern as markDeparted), show success toast.
5. On error: show error toast; keep dialog open.

---

## API functions

**React** — already exist in `ui/react-prototype/src/api/privacy.ts`:
- `eraseMyContact(): Promise<void>` — `DELETE /directory/contact`
- `eraseContact(householdRef): Promise<'erased' | 'not-found'>` — `DELETE /directory/{ref}/contact`, returns 204

**Angular** — do NOT exist yet in `DirectoryService`; add them following the same pattern as `markDeparted`:
- `eraseMyContact(): Observable<void>` — `DELETE /directory/contact`
- `eraseContact(householdRef: string): Observable<void>` — `DELETE /directory/{ref}/contact`

---

## Constraints

- R2: no household ref is derived from the UI for the resident self-erase path; the API derives it from the session.
- R3: `householdRef` is shown in the confirmation dialog UI (visible only to the admin who initiated the action) — this is intentional and correct; it is not logged.
- No new route, no new service (Angular DirectoryService extended, not replaced).
- Dialog pattern follows `MarkDepartedDialog` (React) / inline `p-dialog` depart block (Angular).
