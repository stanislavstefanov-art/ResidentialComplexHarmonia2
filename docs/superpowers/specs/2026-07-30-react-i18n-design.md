# React i18n — Design

**Date:** 2026-07-30
**Branch:** feat/react-i18n
**Status:** Approved
**Slice:** 1 of 2 (React now; Angular is a separate follow-up slice)

---

## Goal

Add a runtime internationalization framework to the React (MUI 9) Harmonia UI supporting
three languages — **Bulgarian (default)**, **Russian**, and **English** — with a persisted
language switcher. Replace every hardcoded English UI string with a translation key.

Bulgarian is the default language for real users. English and Russian are selectable.

## Non-Goals

- Angular UI (delivered as a separate slice with its own spec/plan/PR).
- Deep date/number locale formatting beyond what MUI's locale pack and the existing
  `toLocaleDateString()` calls already provide.
- Translating backend/API responses or server-emitted messages.
- Browser-language auto-detection (BG is the mandated default; only an explicit saved
  choice overrides it).

## Approach

Use **react-i18next** (i18next). It is the de-facto standard for React i18n: runtime
language switching, JSON translation files, interpolation/pluralization, a browser
language-detector plugin, and localStorage persistence. Retrofitting is mechanical:
`const { t } = useTranslation()` then `t('directory.title')`.

Rejected alternatives: **react-intl/FormatJS** (more verbose `<FormattedMessage>` retrofit
across 135 strings) and a **hand-rolled context** (would reinvent detection, persistence,
pluralization, and fallbacks for no benefit).

## Architecture

### 1. i18n infrastructure

New dependencies: `i18next`, `react-i18next`, `i18next-browser-languagedetector`.

New folder `ui/react/src/i18n/`:

- `index.ts` — initializes i18next once and exports the instance.
- `locales/bg.json`, `locales/ru.json`, `locales/en.json` — one flat-ish JSON per language
  with keys namespaced by screen.

Initialization config:

- `fallbackLng: 'bg'`, `supportedLngs: ['bg', 'ru', 'en']`.
- `LanguageDetector` with `order: ['localStorage']`, `caches: ['localStorage']`,
  `lookupLocalStorage: 'harmonia.lang'`. No `navigator` detection — so a user with no saved
  choice gets Bulgarian.
- `interpolation.escapeValue: false` (React already escapes).
- A single default namespace (`translation`).

`index.ts` is imported for its side effect at the top of `ui/react/src/index.tsx` (before
`root.render`).

### 2. Translation keys

Keys are grouped by area. Illustrative structure (not exhaustive):

```
nav.directory, nav.reservations, nav.finance, nav.expenses, nav.fees,
nav.payments, nav.notifications, nav.privacy, nav.contactEdit, nav.adminPending
common.cancel, common.save, common.close, common.retry, common.delete, common.edit
signIn.title, signIn.subtitle, signIn.button
directory.title, directory.residentSubtitle, directory.adminSubtitle,
directory.myProfile, directory.searchResidents, directory.noResidents, ...
```

`en.json` values are the **exact current English strings** (verbatim), so the English
rendering is byte-identical to today. `bg.json` is authored for review; `ru.json` is
generated (machine-quality until a speaker reviews).

### 3. Dynamic MUI locale

Today `App.tsx` calls `createTheme({...}, bgBG)` unconditionally. The MUI locale must follow
the active language. A `MuiLocalizedTheme` wrapper reads `i18n.language` (via
`useTranslation`), maps it to the matching MUI locale pack
(`bg → bgBG`, `ru → ruRU`, `en → enUS` from `@mui/material/locale`), and recomputes the theme
with `useMemo` keyed on language. The base theme options (palette, shape, typography) are
factored into a constant reused across languages.

### 4. Language switcher

A `LanguageSwitcher` component: a globe `IconButton` opening a `Menu` (or a compact
`Select`) with **BG / РУ / EN**. On select it calls `i18n.changeLanguage(code)`, which the
detector auto-persists to `localStorage['harmonia.lang']`.

Placement:

- In the authenticated **AppBar** (`MainApp`), near the display name / sign-out.
- On the unauthenticated **SignInPage**, so a user can pick a language before logging in.

### 5. String replacement

Every hardcoded user-facing string across the 17 components in
`ui/react/src/components/` plus `ui/react/src/App.tsx` is replaced with `t('key')`. This
includes tab labels, buttons, table headers, placeholders, dialog titles/body copy, toast
and error messages, and empty-state text.

## Testing

- **Test environment runs in English.** `ui/react/src/setupTests.ts` imports the i18n
  instance and forces `i18n.changeLanguage('en')`. Because `en.json` mirrors the current
  literals, the existing 96 tests that assert English text keep passing without edits.
  (Any incidental assertion that must change is updated in the same task.)
- **New tests:**
  - Default language is Bulgarian when `localStorage` is empty (a fresh i18n init resolves
    to `bg`).
  - `LanguageSwitcher` renders and, on selecting РУ/EN, updates visible text.
  - Selection persists: after `changeLanguage`, `localStorage['harmonia.lang']` is set;
    a re-init picks it up.
  - Switcher is present in both the AppBar (authenticated) and SignInPage (unauthenticated).
- `tsc --noEmit` clean; full `npm test` suite green.

## Data Flow

1. App boot → `import './i18n'` runs init → LanguageDetector reads
   `localStorage['harmonia.lang']`; if absent, language = `bg`.
2. Components call `useTranslation()` and render `t('key')` against the active language file.
3. User picks a language in `LanguageSwitcher` → `i18n.changeLanguage(code)` → i18next
   re-renders subscribers, detector writes `localStorage`, and `MuiLocalizedTheme` recomputes
   the MUI locale.

## Risks & Mitigations

- **Missing key regressions:** a mistyped key renders the raw key string. Mitigation:
  keep keys centralized, and the English-mode test suite surfaces missing/renamed keys as
  failed text assertions.
- **Test breakage from language default:** mitigated by forcing `en` in `setupTests.ts` and
  keeping `en.json` verbatim.
- **Untranslated Russian quality:** accepted for this slice; flagged for later native review.

## Deliverables

- `i18next` + `react-i18next` + `i18next-browser-languagedetector` added to
  `ui/react/package.json`.
- `ui/react/src/i18n/` with `index.ts` and `locales/{bg,ru,en}.json`.
- `LanguageSwitcher` component and dynamic MUI locale wrapper.
- All React components migrated to `t('key')`.
- Updated `setupTests.ts`; new i18n tests; green suite.
