# Angular i18n Design

## Goal

Add runtime i18n to the Angular (PrimeNG 22) Harmonia UI with Bulgarian (default), Russian, and English — matching the React i18n already merged in PR #55. Includes a language switcher in every page header, localStorage persistence, and dynamic PrimeNG date-picker locale switching.

---

## Context

- Angular 21.2, standalone components, `inject()` DI, `@if`/`@for` control flow
- 10 page components each owning their own header + nav HTML (no shared shell)
- PrimeNG 22 date-picker translations currently hardcoded Bulgarian in `app.config.ts`
- React locale files (`ui/react/src/i18n/locales/bg.json`, `en.json`, `ru.json`) define the canonical key structure
- 85 existing Angular vitest tests pass via `ng test --watch=false`

---

## Library

**`@ngx-translate/core` + `@ngx-translate/http-loader`**

Standard Angular runtime i18n library. JSON files served from `/assets/i18n/` via `TranslateHttpLoader`. Templates use `{{ 'key' | translate }}` pipe; TypeScript uses `TranslateService.instant('key', params)`. Standalone component setup via `provideTranslateService()` in `app.config.ts`.

---

## Architecture

### New files

| Path | Responsibility |
|------|---------------|
| `src/assets/i18n/bg.json` | Bulgarian translations (copy from React locale) |
| `src/assets/i18n/en.json` | English translations (copy from React locale) |
| `src/assets/i18n/ru.json` | Russian translations (copy from React locale) |
| `src/app/language.service.ts` | Active language: read/write localStorage, call `TranslateService.use()`, call `PrimeNGConfig.setTranslation()` |
| `src/app/language.service.spec.ts` | Unit tests for LanguageService |
| `src/app/language-switcher/language-switcher.component.ts` | Standalone component: three buttons `BG \| РУ \| EN`, calls `LanguageService.use(lang)` |
| `src/app/language-switcher/language-switcher.component.spec.ts` | Tests for LanguageSwitcherComponent |
| `src/app/language.parity.spec.ts` | Locale parity test: all keys in en.json present in bg.json and ru.json |
| `src/testing/translate-testing.ts` | Shared `provideTranslateTesting()` helper for existing specs |

### Modified files

| Path | Change |
|------|--------|
| `app.config.ts` | Add `provideTranslateService()` with `TranslateHttpLoader`; remove hardcoded PrimeNG `translation:` block |
| `app.ts` | Call `LanguageService.init()` in `ngOnInit()` before first route renders |
| 10 page components + `resident-pending.component.ts` | Import `TranslatePipe` + `LanguageSwitcherComponent`; replace hardcoded strings with `\| translate`; add `<app-language-switcher>` to header |
| All existing `*.spec.ts` files | Add `provideTranslateTesting()` to `TestBed.configureTestingModule()` imports |

---

## LanguageService

```ts
// Responsibilities:
// 1. Read active language from localStorage (key: 'harmonia-lang'), default 'bg'
// 2. On init and on use(): call TranslateService.use(lang)
// 3. On init and on use(): call PrimeNGConfig.setTranslation(PRIMENG_TRANSLATIONS[lang])

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private static readonly STORAGE_KEY = 'harmonia-lang';
  static readonly SUPPORTED = ['bg', 'en', 'ru'] as const;
  type Lang = typeof LanguageService.SUPPORTED[number];

  // PRIMENG_TRANSLATIONS: static map of BG/EN/RU PrimeNG translation objects
  // covering dayNames, dayNamesShort, dayNamesMin, monthNames, monthNamesShort,
  // today, clear, weekHeader, dateFormat, accept, reject, cancel, aria.*
  // BG: existing values from app.config.ts
  // EN: English equivalents
  // RU: Russian equivalents

  init(): void { /* read localStorage, apply language */ }
  use(lang: Lang): void { /* persist to localStorage, apply language */ }
  current(): Lang { /* return active language */ }
}
```

`init()` is called once from `App.ngOnInit()` after MSAL settles, ensuring the correct locale is active before any page component renders.

---

## LanguageSwitcherComponent

Standalone component added to every page component's `imports` array and placed at the far-right of the header, after all nav links.

```html
<div class="lang-switcher">
  <button [class.active]="current === 'bg'" (click)="use('bg')">BG</button>
  <span class="sep">|</span>
  <button [class.active]="current === 'ru'" (click)="use('ru')">РУ</button>
  <span class="sep">|</span>
  <button [class.active]="current === 'en'" (click)="use('en')">EN</button>
</div>
```

Styled to match the existing `nav-link` pattern (white, low-opacity unless active; `nav-active` equivalent for the selected language). No icons.

The component reads `LanguageService.current()` for the active state and calls `LanguageService.use(lang)` on click. It uses `TranslateService.onLangChange` (as an Observable) to update the `current` property reactively so the active button stays in sync.

---

## Template translation pattern

**Static strings:**
```html
<!-- before -->
<a routerLink="/directory" class="nav-link">Directory</a>

<!-- after -->
<a routerLink="/directory" class="nav-link">{{ 'nav.directory' | translate }}</a>
```

**Attribute bindings:**
```html
<p-button [label]="'common.retry' | translate" />
<input [placeholder]="'directory.searchAdmin' | translate" />
```

**Interpolated strings (params):**
```html
{{ 'directory.toastDeparted' | translate : { ref: household } }}
```

**TypeScript (toast messages, error signals):**
```ts
private readonly t = inject(TranslateService);

this.msg.add({
  severity: 'success',
  summary: this.t.instant('reservation.claim'),
  detail: this.t.instant('reservation.confirmed', { slotKey })
});
```

Each component adds `TranslatePipe` to its `imports` array. Components that call `t.instant()` also inject `TranslateService`.

---

## app.config.ts changes

```ts
// Remove: hardcoded translation: { ... } block from providePrimeNG()
// Add:
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

// In providers:
provideTranslateService({
  loader: {
    provide: TranslateLoader,
    useFactory: () => new TranslateHttpLoader(inject(HttpClient), '/assets/i18n/', '.json'),
  },
  defaultLanguage: 'bg',
}),
```

`PrimeNGConfig.setTranslation()` is no longer called at config time — LanguageService does it at runtime.

---

## Testing

### Existing specs — translate helper

```ts
// src/testing/translate-testing.ts
import { of } from 'rxjs';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';

class FakeLoader implements TranslateLoader {
  getTranslation() { return of({}); }
}

export const provideTranslateTesting = () =>
  TranslateModule.forRoot({ loader: { provide: TranslateLoader, useClass: FakeLoader } });
```

Every existing spec adds this to `imports` in `TestBed.configureTestingModule()`. With an empty translation map, `| translate` renders the raw key string. Existing assertions target `data-testid`, API calls, and signal values — not rendered text — so no behavioral changes are needed.

### LanguageService tests

- `init()` with no localStorage → language is `'bg'`, `translateService.use` called with `'bg'`, `primeNGConfig.setTranslation` called
- `init()` with `'en'` in localStorage → language is `'en'`
- `use('ru')` → localStorage set to `'ru'`, both side effects called with `'ru'` data
- `use()` with unsupported value → silently ignored, language unchanged

### LanguageSwitcherComponent tests

- Renders buttons with text `BG`, `РУ`, `EN`
- `BG` button has `active` class when current language is `'bg'`
- Clicking `EN` button calls `languageService.use('en')`
- Active button updates when language changes

### Locale parity test

```ts
// src/app/language.parity.spec.ts
import en from '../../assets/i18n/en.json';
import bg from '../../assets/i18n/bg.json';
import ru from '../../assets/i18n/ru.json';

const flatKeys = (obj: object, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' ? flatKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  );

it('bg contains all keys from en', () => {
  expect(flatKeys(bg)).toEqual(flatKeys(en));
});
it('ru contains all keys from en', () => {
  expect(flatKeys(ru)).toEqual(flatKeys(en));
});
```

---

## PrimeNG dynamic locale

`LanguageService.PRIMENG_TRANSLATIONS` is a static record containing the full PrimeNG translation object for each language:

- **`bg`**: existing values from `app.config.ts` (dayNames, monthNames, today, clear, weekHeader `dateFormat: 'dd.mm.yy'`, aria.*)
- **`en`**: English equivalents (`dateFormat: 'mm/dd/yy'`)
- **`ru`**: Russian equivalents (`dateFormat: 'dd.mm.yy'`)

On `init()` and `use()`, `PrimeNGConfig.setTranslation(PRIMENG_TRANSLATIONS[lang])` replaces the active locale, so the date picker calendar switches language immediately.

---

## Scope boundaries

**In scope:**
- All hardcoded UI strings in 10 page components + `resident-pending.component.ts`
- Header nav link labels
- PrimeNG component labels and attributes (`[label]`, `[placeholder]`, etc.)
- Toast/error messages set in TypeScript
- PrimeNG date-picker locale (day/month names)
- localStorage persistence
- Locale parity test

**Out of scope:**
- `@angular/localize` compile-time i18n (wrong tool for runtime switching)
- Number/currency/date pipe locale formatting (Angular's `LOCALE_ID` stays `'bg'` for date pipe; PrimeNG handles its own date picker)
- Server-side rendering
- RTL layout (Russian and Bulgarian are LTR)
