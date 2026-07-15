# Work Item — Member Directory (Phase 3, Slice A)

**Status**: In Progress
**Branch**: feat/member-directory
**External Ticket**: none

## Goal

Every resident can view who lives in each apartment; the board sees full contact details (phone, email) and operational notes per apartment; residents can self-update their own contact details; the board can manage notes and assist residents.

## Acceptance Criteria

- GET /directory — authenticated resident sees a list of all apartments with occupant names only (no contact details)
- GET /directory — board member sees full contact details (phone + email) plus notes per apartment
- PUT /directory/contact — resident updates their own phone and/or email (session-derived HouseholdRef, R2)
- PUT /directory/{apartmentId}/contact — board updates contact details on behalf of any resident
- PUT /directory/{apartmentId}/notes — board adds/updates operational notes for any apartment
- R3: phone and email never appear in ILogger calls
- R2: resident self-update derives HouseholdRef exclusively from ISession.Resolve(); never from request body

## Context

- Same stack: .NET 8 minimal-API, raw ADO.NET, SQL Server, three-layer (Domain → Application → Api), xUnit
- R2: HouseholdRef always session-derived
- R3: personal data (phone, email) never logged
- Phase 3, Slice A — first vertical slice of the member directory capability

## Linked Artifacts

- docs/superpowers/runs/20260714-1305-master/requirements.md

## History

- 2026-07-14T13:06:00Z — work item created by requirements-intake for run 20260714-1305-master; external sync pending (no ticket adapter configured)
- 2026-07-14T13:08:00Z — branch feat/member-directory created from master 261dffd; development started
