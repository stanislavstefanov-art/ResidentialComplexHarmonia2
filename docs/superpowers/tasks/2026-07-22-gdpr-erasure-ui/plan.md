# GDPR Self-Service Erasure UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add resident self-erase and admin erase-contact UI flows to both Angular and React directory screens, calling the already-implemented backend erasure endpoints.

**Architecture:** UI-only change. Two new React dialog components; four existing files modified (two React, two Angular). No backend, no API, no schema changes.

**Tech Stack:** React 18 + MUI v9 (DataGrid), Angular 21 + PrimeNG 22, TypeScript.

---

## File Map

| File | Change type |
|------|-------------|
| `ui/react-prototype/src/components/EraseMyContactDialog.tsx` | **Create** |
| `ui/react-prototype/src/components/EraseContactDialog.tsx` | **Create** |
| `ui/react-prototype/src/components/EditContactDialog.tsx` | **Modify** — add `onRequestErase` prop + button |
| `ui/react-prototype/src/components/DirectoryList.tsx` | **Modify** — wire state, handlers, dialogs, admin icon |
| `ui/angular-prototype/src/app/directory/directory.service.ts` | **Modify** — add 2 methods |
| `ui/angular-prototype/src/app/directory/directory-list.component.ts` | **Modify** — wire signals, handlers, dialogs, admin icon |

---

## Task 1 — React: new erase dialog components

**Test-first: no** — pure presentational components; verified visually via Task 2.

**Files:**
- Create: `ui/react-prototype/src/components/EraseMyContactDialog.tsx`
- Create: `ui/react-prototype/src/components/EraseContactDialog.tsx`

- [ ] **Step 1: Create `EraseMyContactDialog.tsx`**

  ```tsx
  import React from 'react';
  import {
    Button, CircularProgress,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  } from '@mui/material';

  interface Props {
    open: boolean;
    erasing: boolean;
    onConfirm: () => void;
    onClose: () => void;
  }

  const EraseMyContactDialog: React.FC<Props> = ({ open, erasing, onConfirm, onClose }) => (
    <Dialog open={open} onClose={erasing ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete my data?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          All your contact information will be <strong>permanently deleted</strong>.
          This cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={erasing}>Cancel</Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          disabled={erasing}
          startIcon={erasing ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {erasing ? 'Deleting…' : 'Delete my data'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  export default EraseMyContactDialog;
  ```

- [ ] **Step 2: Create `EraseContactDialog.tsx`**

  ```tsx
  import React from 'react';
  import {
    Button, CircularProgress,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  } from '@mui/material';

  interface Props {
    open: boolean;
    householdRef: string;
    erasing: boolean;
    onConfirm: () => void;
    onClose: () => void;
  }

  const EraseContactDialog: React.FC<Props> = ({ open, householdRef, erasing, onConfirm, onClose }) => (
    <Dialog open={open} onClose={erasing ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Erase contact data?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          All data for apartment <strong>{householdRef}</strong> will be{' '}
          <strong>permanently deleted</strong>. This cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={erasing}>Cancel</Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          disabled={erasing}
          startIcon={erasing ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {erasing ? 'Erasing…' : 'Erase contact'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  export default EraseContactDialog;
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```powershell
  cd ui/react-prototype && npx tsc --noEmit 2>&1 | head -20
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```powershell
  git add ui/react-prototype/src/components/EraseMyContactDialog.tsx
  git add ui/react-prototype/src/components/EraseContactDialog.tsx
  git commit -m "feat(react): add EraseMyContactDialog and EraseContactDialog components"
  ```

---

## Task 2 — React: wire erase flows into DirectoryList + EditContactDialog

**Test-first: no** — UI integration; verified by TypeScript compilation.

**Files:**
- Modify: `ui/react-prototype/src/components/EditContactDialog.tsx`
- Modify: `ui/react-prototype/src/components/DirectoryList.tsx`

- [ ] **Step 1: Add `onRequestErase` prop to `EditContactDialog`**

  Add `onRequestErase: () => void` to the `Props` interface and destructure it.

  **New Props interface:**
  ```tsx
  interface Props {
    open: boolean;
    saving: boolean;
    form: MyContact;
    onChange: (updated: MyContact) => void;
    onSave: () => void;
    onClose: () => void;
    onRequestErase: () => void;
  }
  ```

  **Updated destructure line:**
  ```tsx
  const EditContactDialog: React.FC<Props> = ({ open, saving, form, onChange, onSave, onClose, onRequestErase }) => {
  ```

  **Updated DialogActions** (replace the existing `<DialogActions>` block):
  ```tsx
  <DialogActions sx={{ px: 3, pb: 2 }}>
    <Button onClick={onRequestErase} color="error" disabled={saving} sx={{ mr: 'auto' }}>
      Delete my data
    </Button>
    <Button onClick={onClose} color="inherit" disabled={saving}>
      Cancel
    </Button>
    <Button
      onClick={onSave}
      variant="contained"
      disabled={saving}
      startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
    >
      {saving ? 'Saving…' : 'Save'}
    </Button>
  </DialogActions>
  ```

- [ ] **Step 2: Wire state and handlers in `DirectoryList.tsx`**

  **Add imports** at the top (after the existing imports):
  ```tsx
  import DeleteForeverIcon from '@mui/icons-material/DeleteForeverOutlined';
  import { eraseMyContact, eraseContact } from '../api/privacy';
  import EraseMyContactDialog from './EraseMyContactDialog';
  import EraseContactDialog from './EraseContactDialog';
  ```

  **Add state** (inside the component, after the existing `const [departing, setDeparting]` state):
  ```tsx
  const [eraseMyOpen, setEraseMyOpen]           = useState(false);
  const [erasingMy, setErasingMy]               = useState(false);
  const [eraseContactOpen, setEraseContactOpen] = useState(false);
  const [eraseContactRef, setEraseContactRef]   = useState('');
  const [erasingContact, setErasingContact]     = useState(false);
  ```

  **Add handlers** (after `handleDepart`):
  ```tsx
  const handleEraseMyContact = async () => {
    setErasingMy(true);
    try {
      await eraseMyContact();
      setEraseMyOpen(false);
      setResidentDialogOpen(false);
      setRows([]);
      showToast('Your data has been permanently deleted.');
    } catch {
      setError('Could not delete your data. Please try again.');
    } finally {
      setErasingMy(false);
    }
  };

  const handleEraseContact = async () => {
    setErasingContact(true);
    try {
      await eraseContact(eraseContactRef);
      setAdminRows(prev => prev.filter(r => r.householdRef !== eraseContactRef));
      setEraseContactOpen(false);
      showToast(`Data for ${eraseContactRef} has been permanently deleted.`);
    } catch {
      setError('Could not erase contact data. Please try again.');
    } finally {
      setErasingContact(false);
    }
  };
  ```

- [ ] **Step 3: Add erase icon to admin action column**

  In the `adminCols` definition, find the `_actions` renderCell. Replace its content:

  Before:
  ```tsx
  renderCell: (p: GridRenderCellParams<DirectoryEntryAdmin>) => (
    <Box sx={{ display: 'flex', gap: 0.25 }}>
      <IconButton size="small" title="Edit" onClick={() => openAdminEdit(p.row)}>
        <EditIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" color="error" title="Mark Departed" onClick={() => openDepart(p.row.householdRef)}>
        <PersonOffIcon fontSize="small" />
      </IconButton>
    </Box>
  ),
  ```

  After:
  ```tsx
  renderCell: (p: GridRenderCellParams<DirectoryEntryAdmin>) => (
    <Box sx={{ display: 'flex', gap: 0.25 }}>
      <IconButton size="small" title="Edit" onClick={() => openAdminEdit(p.row)}>
        <EditIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" color="error" title="Mark Departed" onClick={() => openDepart(p.row.householdRef)}>
        <PersonOffIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" color="error" title="Erase contact data"
        onClick={() => { setEraseContactRef(p.row.householdRef); setEraseContactOpen(true); }}>
        <DeleteForeverIcon fontSize="small" />
      </IconButton>
    </Box>
  ),
  ```

  Also update the `width` of the `_actions` column from `88` to `120`:
  ```tsx
  { field: '_actions', headerName: '', width: 120, ... }
  ```

- [ ] **Step 4: Pass `onRequestErase` to `EditContactDialog` and add both dialogs**

  Update the `<EditContactDialog>` usage:
  ```tsx
  <EditContactDialog
    open={residentDialogOpen}
    saving={saving}
    form={residentForm}
    onChange={setResidentForm}
    onSave={handleResidentSave}
    onClose={() => setResidentDialogOpen(false)}
    onRequestErase={() => { setResidentDialogOpen(false); setEraseMyOpen(true); }}
  />
  ```

  After the existing dialogs, add:
  ```tsx
  <EraseMyContactDialog
    open={eraseMyOpen}
    erasing={erasingMy}
    onConfirm={handleEraseMyContact}
    onClose={() => setEraseMyOpen(false)}
  />

  <EraseContactDialog
    open={eraseContactOpen}
    householdRef={eraseContactRef}
    erasing={erasingContact}
    onConfirm={handleEraseContact}
    onClose={() => setEraseContactOpen(false)}
  />
  ```

- [ ] **Step 5: Verify TypeScript compiles**

  ```powershell
  cd ui/react-prototype && npx tsc --noEmit 2>&1 | head -20
  ```

  Expected: no errors.

- [ ] **Step 6: Commit**

  ```powershell
  git add ui/react-prototype/src/components/EditContactDialog.tsx
  git add ui/react-prototype/src/components/DirectoryList.tsx
  git commit -m "feat(react): wire resident self-erase and admin erase-contact in DirectoryList"
  ```

---

## Task 3 — Angular: add erase methods to DirectoryService

**Test-first: no** — service methods; verified by TypeScript compilation and Task 4 integration.

**Files:**
- Modify: `ui/angular-prototype/src/app/directory/directory.service.ts`

- [ ] **Step 1: Add `eraseMyContact` and `eraseContact` to `DirectoryService`**

  After the `markDeparted` method (end of class), append:

  ```ts
  eraseMyContact(): Observable<void> {
    return this.http.delete<void>(`${API}/directory/contact`);
  }

  eraseContact(householdRef: string): Observable<void> {
    return this.http.delete<void>(`${API}/directory/${encodeURIComponent(householdRef)}/contact`);
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```powershell
  cd ui/angular-prototype && npx tsc --noEmit 2>&1 | head -20
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```powershell
  git add ui/angular-prototype/src/app/directory/directory.service.ts
  git commit -m "feat(angular): add eraseMyContact and eraseContact to DirectoryService"
  ```

---

## Task 4 — Angular: wire erase flows into DirectoryListComponent

**Test-first: no** — UI integration; verified by TypeScript compilation.

**Files:**
- Modify: `ui/angular-prototype/src/app/directory/directory-list.component.ts`

- [ ] **Step 1: Add erase signals and state**

  After the `departing = signal(false);` line, add:

  ```ts
  // ── erase my contact ──
  eraseMyVisible = false;
  erasing        = signal(false);

  // ── erase contact (admin) ──
  eraseContactVisible = false;
  eraseContactRef     = '';
  erasingContact      = signal(false);
  ```

- [ ] **Step 2: Add erase handlers**

  After `confirmDepart()`, add:

  ```ts
  // ── erase my contact handlers ──
  openEraseMyContact() {
    this.editVisible    = false;
    this.eraseMyVisible = true;
  }

  confirmEraseMyContact() {
    this.erasing.set(true);
    this.svc.eraseMyContact().subscribe({
      next: () => {
        this.erasing.set(false);
        this.eraseMyVisible = false;
        this.entries.set([]);
        this.msg.add({ severity: 'success', summary: 'Deleted', detail: 'Your data has been permanently deleted.' });
      },
      error: () => {
        this.erasing.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'Could not delete your data.' });
      },
    });
  }

  // ── erase contact handlers (admin) ──
  openEraseContact(householdRef: string) {
    this.eraseContactRef     = householdRef;
    this.eraseContactVisible = true;
  }

  confirmEraseContact() {
    this.erasingContact.set(true);
    this.svc.eraseContact(this.eraseContactRef).subscribe({
      next: () => {
        this.erasingContact.set(false);
        this.eraseContactVisible = false;
        this.adminEntries.update(list => list.filter(e => e.householdRef !== this.eraseContactRef));
        this.msg.add({ severity: 'success', summary: 'Erased', detail: `Data for ${this.eraseContactRef} permanently deleted.` });
      },
      error: () => {
        this.erasingContact.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'Could not erase contact data.' });
      },
    });
  }
  ```

- [ ] **Step 3: Add "Delete my data" button to resident edit dialog footer**

  Find the `<ng-template #footer>` inside the resident edit `p-dialog` (around line 278). Replace:

  Before:
  ```html
  <ng-template #footer>
    <p-button label="Cancel" icon="pi pi-times" severity="secondary"
      [outlined]="true" (onClick)="editVisible = false" />
    <p-button label="Save" icon="pi pi-check"
      [loading]="saving()" (onClick)="save()" />
  </ng-template>
  ```

  After:
  ```html
  <ng-template #footer>
    <p-button label="Delete my data" icon="pi pi-trash" severity="danger"
      [outlined]="true" (onClick)="openEraseMyContact()" style="margin-right:auto" />
    <p-button label="Cancel" icon="pi pi-times" severity="secondary"
      [outlined]="true" (onClick)="editVisible = false" />
    <p-button label="Save" icon="pi pi-check"
      [loading]="saving()" (onClick)="save()" />
  </ng-template>
  ```

- [ ] **Step 4: Add erase icon to admin action column**

  Find the `<div class="action-cell">` in the admin table body template. Replace:

  Before:
  ```html
  <div class="action-cell">
    <p-button
      icon="pi pi-pencil"
      [rounded]="true" [text]="true"
      severity="secondary" size="small"
      (onClick)="openAdminEdit(entry)"
    />
    <p-button
      icon="pi pi-user-minus"
      [rounded]="true" [text]="true"
      severity="danger" size="small"
      (onClick)="openDepartConfirm(entry.householdRef)"
    />
  </div>
  ```

  After:
  ```html
  <div class="action-cell">
    <p-button
      icon="pi pi-pencil"
      [rounded]="true" [text]="true"
      severity="secondary" size="small"
      (onClick)="openAdminEdit(entry)"
    />
    <p-button
      icon="pi pi-user-minus"
      [rounded]="true" [text]="true"
      severity="danger" size="small"
      (onClick)="openDepartConfirm(entry.householdRef)"
    />
    <p-button
      icon="pi pi-trash"
      [rounded]="true" [text]="true"
      severity="danger" size="small"
      title="Erase contact data"
      (onClick)="openEraseContact(entry.householdRef)"
    />
  </div>
  ```

  Also update the action column header width from `7rem` to `9rem`:
  ```html
  <th style="width:9rem"></th>
  ```

  And update `colspan` in the `#emptymessage` template from `7` to `7` (no change — column count unchanged).

- [ ] **Step 5: Add erase-my-contact confirmation dialog**

  After the `<!-- ── Mark Departed confirm dialog ── -->` block (after line 355), add:

  ```html
  <!-- ── Erase my contact dialog ── -->
  <p-dialog
    [(visible)]="eraseMyVisible"
    header="Delete my data?"
    [modal]="true" [style]="{ width: '28rem' }"
    [draggable]="false" [resizable]="false"
    [closable]="!erasing()"
  >
    <p class="depart-message">
      All your contact information will be <strong>permanently deleted</strong>.
      This cannot be undone.
    </p>
    <ng-template #footer>
      <p-button
        label="Cancel" icon="pi pi-times"
        severity="secondary" [outlined]="true"
        [disabled]="erasing()"
        (onClick)="eraseMyVisible = false"
      />
      <p-button
        label="Delete my data" icon="pi pi-trash"
        severity="danger"
        [loading]="erasing()"
        (onClick)="confirmEraseMyContact()"
      />
    </ng-template>
  </p-dialog>

  <!-- ── Erase contact dialog (admin) ── -->
  <p-dialog
    [(visible)]="eraseContactVisible"
    header="Erase contact data?"
    [modal]="true" [style]="{ width: '28rem' }"
    [draggable]="false" [resizable]="false"
    [closable]="!erasingContact()"
  >
    <p class="depart-message">
      All data for apartment <strong>{{ eraseContactRef }}</strong> will be
      <strong>permanently deleted</strong>. This cannot be undone.
    </p>
    <ng-template #footer>
      <p-button
        label="Cancel" icon="pi pi-times"
        severity="secondary" [outlined]="true"
        [disabled]="erasingContact()"
        (onClick)="eraseContactVisible = false"
      />
      <p-button
        label="Erase contact" icon="pi pi-trash"
        severity="danger"
        [loading]="erasingContact()"
        (onClick)="confirmEraseContact()"
      />
    </ng-template>
  </p-dialog>
  ```

- [ ] **Step 6: Verify TypeScript compiles**

  ```powershell
  cd ui/angular-prototype && npx tsc --noEmit 2>&1 | head -20
  ```

  Expected: no errors.

- [ ] **Step 7: Commit**

  ```powershell
  git add ui/angular-prototype/src/app/directory/directory-list.component.ts
  git commit -m "feat(angular): wire resident self-erase and admin erase-contact in DirectoryListComponent"
  ```
