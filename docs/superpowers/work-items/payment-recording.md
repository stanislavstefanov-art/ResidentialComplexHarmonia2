# Work Item — Payment Recording

**Status**: In Progress
**Source**: free-form
**External Ticket**: none
**Branch**: (pending — Phase 2)

## Goal

Admin records maintenance fee payments received from residents by bank transfer; residents view their own payment history; a per-apartment balance view shows total charged minus total paid.

## Acceptance Criteria

- Admin can record a payment received: household (from request body — admin context), amount (EUR), period (YYYY-MM), date received (admin-supplied, DateOnly).
- Admin can list all payments across all apartments.
- Resident can list their own apartment's payments (household derived from session — R2).
- Balance view: total maintenance fee charges billed minus total payments received for a given period or YTD, per apartment.
- Append-only ledger — no UPDATE or DELETE.
- Same stack: SQL Server, raw ADO.NET, TypedResults, ISession for identity.

## Linked Artifacts

- `docs/superpowers/runs/20260713-1200-master/requirements.md`

## History

- 2026-07-13T12:00:00Z — work item created from free-form input (sdlc-pipeline run 20260713-1200-master)
- External sync: pending (no ticket adapter configured)
