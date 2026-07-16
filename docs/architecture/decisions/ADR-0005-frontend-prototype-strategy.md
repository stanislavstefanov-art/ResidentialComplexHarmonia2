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

- Angular prototype lives under `ui/angular-prototype/`.
- React prototype lives under `ui/react-prototype/`.
- Both connect to the Harmonia API (`GET /directory`, `PUT /directory/contact`,
  `PUT /directory/contact` with `isOptedOut`) running locally.
- Neither prototype is production-grade; no auth integration, no error boundary, no CI pipeline.
- Framework selection for a full UI build is a separate decision, recorded in a future ADR after
  both prototypes are reviewed.
- The Blazor WASM frontend (separate repo) is unaffected by this exercise.
