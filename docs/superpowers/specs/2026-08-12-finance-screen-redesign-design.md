# Finance Screen Redesign — Design

**Date:** 2026-08-12
**Status:** Approved (design)
**Scope:** React (`ui/react`) + Angular (`ui/angular`) — parity required.

## Problem

The finance screen is a single long scroll that mixes every finance task in one
page. For an admin/board member the two most important actions — recording a
bill the building pays (manually or by scanning an invoice) — are buried: the
manual expense form sits in the middle and the invoice scanner is dead last. The
screen has too much information for one view.

Today's admin order: period summary → maintenance fees (form + table) → building
expenses (form + table) → payments (balances + form + table) → annual report
(income form + matrix) → invoice scanner.

In this data model a "bill/invoice the building pays" is an **expense**; the scan
feature prefills an expense. So "put bill entry at the top" means surfacing
expense entry (scan + manual) first.

## Goals

- Put bill entry (scan + manual) first and make it the primary admin action.
- Split the overloaded screen into tabs so each task is focused.
- Keep the two production frontends at parity.
- No backend changes: same endpoints, same DTOs.
- Leave the resident experience unchanged.

## Non-goals

- No API, DTO, or persistence changes.
- No redesign of the resident view.
- No new finance capabilities — this is reorganization plus one form merge.

## Information architecture

A persistent **summary bar** stays pinned above the tabs (unchanged behavior):
the month picker plus the two period totals (charges / expenses).

**Admin tabs** (default tab = **Bills**):

| Tab | Contents |
|---|---|
| **Bills** *(default)* | "Add a bill" card at top (scan + manual, unified), then the **Expenses** list (money out) below |
| **Fees** | Record maintenance-fee charge form + charges table |
| **Payments** | Household balances card + record-payment form + payments table |
| **Report** | Record income form + year picker + annual matrix + Excel download |

**Resident view:** unchanged. Today's single scroll — their balance, their
charges, their payments, and the "request payment" dialog. No tabs. Residents
have little content and no data entry, so tabs add nothing.

## The "Add a bill" unification

Today scan and manual are two near-identical forms far apart in the file
(`handleExpSubmit` for manual, `handleScanSubmit` for the scan result — both call
`recordExpense`). They merge into **one** expense form:

- **Scan is the primary path:** upload an invoice → it prefills the shared form
  (amount, date, vendor → description, category) and shows a confidence chip →
  admin reviews → Save.
- **Manual is the same form** without prefill.

One form, one submit path. This removes the duplicate form and delivers the
"at the top" placement.

Scan states are preserved: `idle` (upload control), `scanning` (spinner), and a
prefilled/`done` state where the shared form is populated. On scan error the form
falls back to empty manual entry with a brief error, as today.

## Component structure

### React (`ui/react/src/components/`)

Split the ~680-line `FinancialScreen.tsx` into a shell plus focused units. No API
or behavior changes beyond the form merge.

- `FinancialScreen.tsx` — shell: loads the period summary bar, branches on role,
  renders MUI `Tabs` (admin) or `ResidentFinancial` (resident).
- `financial/BillsTab.tsx` — "Add a bill" card (scan + manual unified) + expenses list.
- `financial/FeesTab.tsx` — record charge form + charges table.
- `financial/PaymentsTab.tsx` — balances card + record-payment form + payments table.
- `financial/ReportTab.tsx` — record income form + year picker + annual matrix + Excel.
- `financial/ResidentFinancial.tsx` — the unchanged resident scroll.
- A small `formatEur` helper moves to a shared util rather than being redefined.

Tab state is local component state; the default tab is `bills`. Existing API
modules (`api/financial`, `api/maintenanceFees`, `api/expenses`, `api/payments`)
are reused unchanged.

### Angular (`ui/angular/src/app/financial/`)

Mirror the same structure with PrimeNG `Tabs`/`TabView`, matching the component
split into child components so the two UIs stay at parity. Reuse the existing
services unchanged. The resident branch renders the current simple view.

## i18n

Add the new UI strings — the four tab labels (`finance.tab.bills`,
`finance.tab.fees`, `finance.tab.payments`, `finance.tab.report`) and the
"Add a bill" heading/labels — to all three locales: Bulgarian (default), Russian,
English, in both the React and Angular locale files. Existing finance keys are
reused where possible.

## Testing

- Preserve existing `data-testid` hooks (`fee-form`, `payment-form`,
  `expense-form`, `expense-row-*`, `charge-row-*`, `payment-row-*`,
  `summary-charges`, `summary-expenses`, `pay-btn`, etc.) so current tests pass
  unchanged after the reorganization.
- Add tests: (1) the admin screen renders with **Bills** as the default active
  tab; (2) each tab's primary content is reachable; (3) a scanned invoice result
  populates the shared "Add a bill" expense form; (4) the resident view renders
  without tabs.
- Mirror the equivalent tests in Angular.

## Risks

- **Frontend drift** — the reservations-tab bug showed the two UIs can diverge.
  Mitigation: implement both in the same change and keep the tab taxonomy
  identical.
- **File-split regressions** — moving large blocks between files can drop props
  or handlers. Mitigation: preserve `data-testid`s and run the existing suites
  before and after.
