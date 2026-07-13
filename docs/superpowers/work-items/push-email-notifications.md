# Work Item — push-email-notifications

**Status:** Ready for review  
**External Ticket:** (none — external sync pending)  
**Branch:** feat/push-email-notifications  

## Goal

Add Web Push (VAPID) and Azure Communication Services email notification delivery for maintenance fee charge events, payment events, and BBQ booking reminders; allow admin broadcast announcements; let residents manage their push subscriptions.

## Acceptance Criteria

- `POST /notifications/subscribe` — authenticated resident saves browser push subscription (endpoint + keys). 201 on create, 200 on update, 403 on non-resident.
- `DELETE /notifications/subscribe` — authenticated resident removes their push subscription. 204 on success, 403 on non-resident.
- `POST /notifications/announce` — admin only; sends a broadcast push+email message to all residents. 202 accepted, 403 on non-admin.
- `GET /notifications` — authenticated resident views their own notification history (last 30 days). 200/403.
- Charge trigger: after `POST /maintenance-fees/charges` succeeds, fire push (and email fallback) to the affected apartment.
- Payment trigger: after `POST /payments` succeeds, fire push (and email fallback) to the affected apartment.
- BBQ reminder: daily timer fires push+email to residents with a booking the following day.
- Push delivery: VAPID direct push to stored browser endpoint. No Azure Notification Hubs.
- Email fallback: Azure Communication Services email, free tier (≤ 100/day).
- GDPR / R3: push subscription endpoint stored per household, never logged. Notification body generic — no amounts, no HouseholdRef in payload. Email address derived from Entra claims at send time, never stored.
- R2: HouseholdRef always session-derived for resident endpoints.

## Context

- Same .NET 8 minimal-API stack and layered architecture as existing features.
- Notification triggers must integrate with existing `RecordCharge` and `RecordPayment` use cases without coupling domain logic to delivery concerns (use a background notification service or post-handler hook).
- BBQ reminder requires a recurring background task (e.g. `IHostedService` or `BackgroundService`).
- VAPID keys must be configured via environment/config — never committed.

## Linked Artifacts

- `docs/superpowers/runs/20260713-1830-master/requirements.md`
- `docs/superpowers/specs/2026-07-13-push-email-notifications-design.md`
- `docs/superpowers/plans/2026-07-13-push-email-notifications.md`
- PR #9: https://github.com/stanislavstefanov-art/ResidentialComplexHarmonia2/pull/9

## History

- 2026-07-13T18:30:00Z — work item created from free-form input (run 20260713-1830-master), external sync pending
- 2026-07-13T21:30:00Z — Phase 7 complete: 19 commits, 159/159 unit tests, branch feat/push-email-notifications
- 2026-07-13T21:50:00Z — Phase 9 code review: 2 rounds (C1/I1/I2 found and fixed), approved high confidence
- 2026-07-13T21:55:00Z — Phase 10 QA gates passed; feature verification n/a (API-only); qa.ready emitted
- 2026-07-13T22:00:00Z — Phase 12 actual complexity: 27/36 XL (initial estimate 24/L, delta +3); handoff ready
