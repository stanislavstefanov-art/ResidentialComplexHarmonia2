# Work Item: Expense Recording

**Status:** In Development
**Branch:** feat/expense-recording
**External Ticket:** none

## Goal

Admin records complex-wide association expenses; residents and admin list all expenses. Append-only ledger with idempotency key. Two endpoints: `POST /expenses` (admin-only) and `GET /expenses` (admin + resident).

## Acceptance Criteria

1. `POST /expenses` — admin-only; 201 on create, 200 on duplicate (idempotent re-POST with same key)
2. `GET /expenses` — accessible to both admin and resident; returns all expenses newest-first
3. Expenses are complex-wide — no `HouseholdRef` field
4. Append-only store — no UPDATE or DELETE
5. SQL Server store via raw ADO.NET (`SqlExpenseStore` pattern, same as `SqlMaintenanceFeeStore`)
6. Idempotency key as PK contribution (same pattern as maintenance fee charge ledger)
7. All existing unit and Rel tests stay green
8. R2: caller identity from session only, never request body
9. R3: no PII in logs (no HouseholdRef on expenses — simpler than fee ledger)
10. Non-admin (resident) calling `POST /expenses` → 403; no session → 403

## Linked Artifacts

- Run: `docs/superpowers/runs/20260712-1745-master/`
- Requirements: `docs/superpowers/runs/20260712-1745-master/requirements.md`

## History

| Date | Event |
|---|---|
| 2026-07-12 | Work item created for run 20260712-1745-master |
