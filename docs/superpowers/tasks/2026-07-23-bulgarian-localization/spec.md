# Bulgarian Localization — Spec

**Date:** 2026-07-23  
**Branch:** feat/bulgarian-localization  
**Status:** Approved

---

## Goal

Set Bulgarian as the default language in both the Angular (PrimeNG 22) and React (MUI 9) UIs.  
Update the dev-mode household reference default from `HH-DEV-1` to `АП. 1` to match Bulgarian apartment naming convention.

---

## Scope

Five targeted changes across three sub-projects. No new packages. No schema changes. No integration test changes.

| # | File | Change |
|---|------|--------|
| 1 | `ui/angular/src/app/app.config.ts` | Add Bulgarian `translation` object to `providePrimeNG()` and add `LOCALE_ID` provider |
| 2 | `ui/angular/src/app/app.ts` | Add `registerLocaleData(localeBg)` side-effect call |
| 3 | `ui/angular/src/app/reservations/reservations.component.ts` | Remove `dateFormat="yy-mm-dd"` override from `<p-datepicker>` |
| 4 | `ui/react/src/App.tsx` | Import `bgBG` from `@mui/material/locale` and pass to `createTheme()` |
| 5 | `src/Harmonia.Api/appsettings.json` + `Program.cs` | Replace `"HH-DEV-1"` with `"АП. 1"` in both locations |

---

## Change Details

### 1 — Angular: PrimeNG Bulgarian translation + LOCALE_ID (`app.config.ts`)

Extend the existing `providePrimeNG()` call with a `translation` property:

```ts
providePrimeNG({
  theme: { preset: Aura, options: { darkModeSelector: false } },
  translation: {
    firstDayOfWeek: 1,
    dayNames: ['Неделя','Понеделник','Вторник','Сряда','Четвъртък','Петък','Събота'],
    dayNamesShort: ['Нед','Пон','Вт','Ср','Чет','Пет','Съб'],
    dayNamesMin: ['Нд','Пн','Вт','Ср','Чт','Пт','Сб'],
    monthNames: ['Януари','Февруари','Март','Април','Май','Юни','Юли','Август','Септември','Октомври','Ноември','Декември'],
    monthNamesShort: ['Яну','Фев','Мар','Апр','Май','Юни','Юли','Авг','Сеп','Окт','Ное','Дек'],
    today: 'Днес',
    clear: 'Изчисти',
    weekHeader: 'Сед',
    dateFormat: 'dd.mm.yy',
    accept: 'Да',
    reject: 'Не',
    choose: 'Избери',
    upload: 'Качи',
    cancel: 'Отказ',
    fileSizeTypes: ['B','KB','MB','GB','TB','PB','EB','ZB','YB'],
    aria: {
      trueLabel: 'Вярно',
      falseLabel: 'Невярно',
      nullLabel: 'Не е избрано',
      star: '1 звезда',
      stars: '{0} звезди',
      selectAll: 'Избери всички',
      unselectAll: 'Премахни всички',
      close: 'Затвори',
      previous: 'Предишен',
      next: 'Следващ',
      navigation: 'Навигация',
      scrollTop: 'Нагоре',
      moveTop: 'Премести най-горе',
      moveUp: 'Премести нагоре',
      moveDown: 'Премести надолу',
      moveBottom: 'Премести най-долу',
      moveToTarget: 'Премести към целта',
      moveToSource: 'Премести към източника',
      moveAllToTarget: 'Премести всички към целта',
      moveAllToSource: 'Премести всички към източника',
      pageLabel: 'Страница {page}',
      firstPageLabel: 'Първа страница',
      lastPageLabel: 'Последна страница',
      nextPageLabel: 'Следваща страница',
      previousPageLabel: 'Предишна страница',
      rowsPerPageLabel: 'Редове на страница',
      jumpToPageDropdownLabel: 'Отиди на страница',
      jumpToPageInputLabel: 'Отиди на страница',
      selectRow: 'Избери ред',
      unselectRow: 'Премахни ред',
      expandRow: 'Разшири ред',
      collapseRow: 'Свий ред',
      showFilterMenu: 'Покажи филтри',
      hideFilterMenu: 'Скрий филтри',
      filterOperator: 'Оператор на филтър',
      filterConstraint: 'Ограничение на филтър',
      editRow: 'Редактирай ред',
      saveEdit: 'Запази',
      cancelEdit: 'Отказ',
      listView: 'Изглед на списък',
      gridView: 'Мрежов изглед',
      slide: 'Слайд',
      slideNumber: 'Слайд {slideNumber}',
      zoomImage: 'Увеличи изображение',
      zoomIn: 'Увеличи',
      zoomOut: 'Намали',
      rotateRight: 'Завърти надясно',
      rotateLeft: 'Завърти наляво',
    },
  },
}),
```

Also add `{ provide: LOCALE_ID, useValue: 'bg' }` to the providers array (`LOCALE_ID` imported from `@angular/core`). This drives Angular's built-in `DatePipe`, `CurrencyPipe`, and `DecimalPipe` to use Bulgarian formatting conventions.

### 2 — Angular: locale registration (`app.ts`)

Add a `registerLocaleData` call at module level (before the component class) so Angular knows about the `bg` locale data:

```ts
import localeBg from '@angular/common/locales/bg';
import { registerLocaleData } from '@angular/common';

registerLocaleData(localeBg);
```

The `localeBg` file is already present on disk at `node_modules/@angular/common/locales/bg.js` — no package installation needed.

### 3 — Angular: remove date format override (`reservations.component.ts`)

Remove `dateFormat="yy-mm-dd"` from the `<p-datepicker>` element at line 58. The global `dateFormat: 'dd.mm.yy'` from the PrimeNG translation object then applies, giving Bulgarian date formatting (`dd.mm.yy`) consistently across all pickers.

### 4 — React: MUI Bulgarian locale adapter (`App.tsx`)

Add `bgBG` from `@mui/material/locale` as the second argument to `createTheme()`:

```ts
import { bgBG } from '@mui/material/locale';

const theme = createTheme(
  {
    palette: { primary: { main: '#2e6b4f' }, background: { default: '#f5f5f0' } },
    shape: { borderRadius: 8 },
    typography: { fontFamily: 'system-ui, -apple-system, sans-serif' },
  },
  bgBG,
);
```

`bgBG` covers MUI component strings: Pagination aria labels, Autocomplete "No options" / "Open" / "Close", Rating labels, Breadcrumbs expansion label, TablePagination rows-per-page label. `@mui/x-date-pickers` is not in the project so date locale is not a concern.

### 5 — API: household ref default (`appsettings.json` + `Program.cs`)

**`src/Harmonia.Api/appsettings.json`** — change the `Session.HouseholdRef` value:
```json
"Session": {
  "HouseholdRef": "АП. 1"
}
```

**`src/Harmonia.Api/Program.cs`** — change the fallback default in `GetValue()`:
```csharp
builder.Configuration.GetValue("Session:HouseholdRef", "АП. 1")
```

Both files are UTF-8 without BOM (already the convention in this repo). Integration tests use independent `HH-*` identifiers (`HH-DIR-1`, `HH-A`, etc.) that are internal test fixtures, not user-facing data — they do not change.

---

## Out of Scope

- Translating hard-coded English UI text strings (tab labels, button labels, error messages) in either UI — this is a separate, larger i18n effort.
- Adding a language switcher — Bulgarian is the single default, no runtime toggle.
- Changing integration test household ref identifiers — they are random test fixtures, not user-facing.

---

## Acceptance Criteria

1. Angular: All PrimeNG calendar/dialog/table components display in Bulgarian.
2. Angular: `DatePipe` and `DecimalPipe` use Bulgarian locale conventions.
3. Angular: Reservation date picker shows dates in `dd.mm.yy` format with Monday as first day of week.
4. React: MUI component strings (Pagination, Autocomplete, etc.) display in Bulgarian.
5. API: `GET /directory` (and all other endpoints) work with the dev session defaulting to `АП. 1` as the household ref.
6. Angular and React builds complete without TypeScript errors.
7. No integration tests broken.
