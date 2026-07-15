# Spec — GDPR Directory Opt-Out

**Task**: gdpr-directory-opt-out
**Branch**: feat/member-directory
**Gate decisions recorded**: 2026-07-15 (HITL)

## Context

`GET /directory` shares `DisplayName` and `HouseholdRef` of every registered resident with every
other authenticated resident. Under EU GDPR Art. 6, cross-user personal data disclosure requires a
confirmed lawful basis.

**Lawful basis confirmed**: Legitimate Interest (Art. 6(1)(f)).
**Art. 21 opt-out right**: mandatory. An opted-out household must be hidden entirely from the
resident view. The board view is not restricted (board has its own legitimate purpose).
**Opt-out actors**: the resident controls their own flag (self-service via `PUT /directory/contact`);
the board can also set it for any household via `PUT /directory/{householdRef}/contact`.

## What changes

### SQL

`dbo.HouseholdContacts` gains one column:

```sql
IsOptedOut BIT NOT NULL DEFAULT 0
```

Safe to apply to existing rows (default 0 = not opted out, i.e. visible).

### Domain

`HouseholdContact` record gains `bool IsOptedOut`. All existing constructors must supply it;
existing data rows default to `false`.

### Application

**`GetDirectory`**: before building `ResidentView`, filter the full list to rows where
`!c.IsOptedOut`. `BoardView` receives the unfiltered list.

**`IDirectoryStore.UpsertContactAsync`**: gains `bool? isOptedOut` parameter.
- `null` → preserve existing value (COALESCE in SQL)
- `true` → opt out; `false` → opt back in

**`UpdateMyContact.ExecuteAsync`**: gains `bool? isOptedOut`; forwards to store.

**`UpdateContact.ExecuteAsync`**: gains `bool? isOptedOut`; forwards to store.

`UpdateNotes` is unchanged (notes are unrelated to opt-out).

### API

**`UpdateContactRequest`** DTO gains `bool? OptedOut`. Field is optional and nullable —
callers that omit it get COALESCE behaviour (no change to existing opt-out status).

Both `UpdateMyContactEndpoint` and `UpdateContactEndpoint` pass `body.OptedOut` into the use case.

**`DirectoryEntryFullDto`** gains `bool IsOptedOut` (positioned before `UpdatedAt`). Board members
can see which households have opted out directly from the listing, enabling follow-up outreach and
directory management without a separate lookup. `IsOptedOut` is not PII; no R3 concern.

### SQL adapter

`SqlDirectoryStore`:
- `ListAllAsync` SELECT adds `IsOptedOut`; `ReadRow` reads ordinal 6
- `UpsertContactAsync` MERGE adds typed `SqlParameter(@IsOptedOut, SqlDbType.Bit)` with
  `COALESCE(@IsOptedOut, target.IsOptedOut)` in both MATCHED and NOT MATCHED branches

## What does NOT change

- `UpdateNotes` and `UpsertNotesAsync` — no opt-out relationship
- `BoardView` projection — board always sees all households
- `DirectoryEntryPublicDto` — opted-out rows simply don't appear; no flag exposed in the resident DTO
- R2, R3 constraints — unchanged
- Endpoint routes — unchanged

## Acceptance criteria

1. A household with `IsOptedOut = true` does NOT appear in `ResidentView` from `GetDirectory`.
2. A household with `IsOptedOut = true` DOES appear in `BoardView` from `GetDirectory`.
3. A resident can set `OptedOut: true` on `PUT /directory/contact` and it persists.
4. A board member can set `OptedOut` for any household via `PUT /directory/{householdRef}/contact`.
5. Passing `OptedOut: null` (or omitting the field) preserves the existing opt-out status.
6. `dbo.HouseholdContacts` schema includes `IsOptedOut BIT NOT NULL DEFAULT 0`.
7. `BoardView` entries in `DirectoryEntryFullDto` include `IsOptedOut: true` for opted-out households and `IsOptedOut: false` for others.
8. All 195 previously passing unit tests continue to pass (call-site updates only, no behaviour change for non-opted-out paths).
