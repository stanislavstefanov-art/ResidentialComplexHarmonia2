# ADR-0005 — Frontend Prototype Strategy: Angular + React Parallel Comparison

**Date:** 2026-07-16
**Status:** Accepted

---

## Context

The Harmonia backend API is complete. The next chapter is UI. Before committing to a frontend
framework and component library for the full UI build, the team will run a parallel prototype
exercise using the member directory screen as the comparison surface.

The canonical Harmonia frontend is Blazor WASM, maintained in a separate repository. These
prototypes are clean-room comparisons and do not replace or extend the Blazor application.

---

## Decision

Build the member directory screen twice — once in Angular, once in React — as standalone
prototypes in this repository under `ui/`. Evaluate the two approaches side by side before
selecting a framework for a potential future full UI build.

### Prototype scope (both frameworks)

- **Member directory listing** — resident view with opted-out residents hidden.
- **Edit own contact form** — resident can update DisplayName, Phone, Email.
- **Opt-out toggle** — resident can toggle their own GDPR opt-out status.

### Component libraries under evaluation

| Framework | Candidate library |
|---|---|
| Angular | PrimeNG or NG-ZORRO |
| React | MUI (Material UI) or shadcn/ui |

The Angular prototype is built first. The React prototype follows using the same screen and
acceptance criteria, enabling a direct comparison.

### Evaluation criteria

1. **Component library richness** — available table, form, and toggle primitives out of the box.
2. **Visual quality** — default and themed appearance without custom CSS.
3. **Developer experience (DX)** — setup friction, type safety, documentation quality, iteration speed.

---

## Consequences

- Angular app lives under `ui/angular-prototype/`.
- React app lives under `ui/react-prototype/`.
- Both connect to the Harmonia API (`GET /directory`, `PUT /directory/contact`,
  `PUT /directory/contact` with `isOptedOut`) running locally.
- Neither app has auth integration or error boundaries yet.
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
Apps). This supersedes the "no CI pipeline" consequence recorded above. The apps are treated as
production-ready screens for the purposes of deployment.
