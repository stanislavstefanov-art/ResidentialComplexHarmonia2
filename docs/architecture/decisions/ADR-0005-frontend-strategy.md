# ADR-0005 — Frontend Strategy: Angular + React Parallel Comparison

**Date:** 2026-07-16
**Status:** Accepted (amended 2026-07-17)

---

## Context

The Harmonia backend API is complete. The next chapter is UI. Before committing to a frontend
framework and component library for the full UI build, the team ran a parallel comparison
exercise using the member directory screen as the comparison surface.

The canonical Harmonia frontend is Blazor WASM, maintained in a separate repository. These
apps are clean-room comparisons and do not replace or extend the Blazor application.

---

## Decision

Build the member directory screen twice — once in Angular, once in React — as standalone
apps in this repository under `ui/`. Evaluate the two approaches side by side before
selecting a framework for a potential future full UI build.

### Initial scope (both frameworks)

- **Member directory listing** — resident view with opted-out residents hidden.
- **Edit own contact form** — resident can update DisplayName, Phone, Email.
- **Opt-out toggle** — resident can toggle their own GDPR opt-out status.

### Component libraries under evaluation

| Framework | Candidate library |
|---|---|
| Angular | PrimeNG or NG-ZORRO |
| React | MUI (Material UI) or shadcn/ui |

The Angular app is built first. The React app follows using the same screen and
acceptance criteria, enabling a direct comparison.

### Evaluation criteria

1. **Component library richness** — available table, form, and toggle primitives out of the box.
2. **Visual quality** — default and themed appearance without custom CSS.
3. **Developer experience (DX)** — setup friction, type safety, documentation quality, iteration speed.

---

## Consequences

- Angular app lives under `ui/angular/`.
- React app lives under `ui/react/`.
- Both connect to the Harmonia API (`GET /directory`, `PUT /directory/contact`) running locally.
- Framework selection for a full UI build is a separate decision, recorded in a future ADR after
  both apps are reviewed.
- The Blazor WASM frontend (separate repo) is unaffected by this exercise.

---

## Amendment — 2026-07-17

**Status:** Amended

The scope of both Angular and React apps has grown well beyond the original member-directory
comparison. As of 2026-07-17, both apps implement the full resident/admin feature set across
Reservations, Maintenance Fees, Expenses, Payments, Notifications, Privacy (GDPR), Financial
Summary, and Contact Edit screens.

**Decision:** Include both apps in the Azure CI/CD pipeline (GitHub Actions → Azure Static Web
Apps). Both apps are treated as production-ready screens for the purposes of deployment and
are no longer comparison experiments.
