import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TranslateService, TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { PrimeNG } from 'primeng/config';
import { LanguageService } from './language.service';

class FakeLoader implements TranslateLoader {
  getTranslation(_lang: string) { return of({}); }
}

function setup() {
  const primeNGSpy = { setTranslation: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: PrimeNG, useValue: primeNGSpy },
    ],
  });
  const svc = TestBed.inject(LanguageService);
  const translate = TestBed.inject(TranslateService);
  return { svc, translate, primeNGSpy };
}

describe('LanguageService', () => {
  beforeEach(() => localStorage.clear());

  it('init() defaults to bg when localStorage is empty', () => {
    const { svc, translate } = setup();
    vi.spyOn(translate, 'use');
    svc.init();
    expect(svc.current()).toBe('bg');
    expect(translate.use).toHaveBeenCalledWith('bg');
  });

  it('init() reads stored language from localStorage', () => {
    localStorage.setItem('harmonia-lang', 'en');
    const { svc, translate } = setup();
    vi.spyOn(translate, 'use');
    svc.init();
    expect(svc.current()).toBe('en');
    expect(translate.use).toHaveBeenCalledWith('en');
  });

  it('setLang() persists language and updates signal', () => {
    const { svc, translate } = setup();
    vi.spyOn(translate, 'use');
    svc.init();
    svc.setLang('ru');
    expect(svc.current()).toBe('ru');
    expect(localStorage.getItem('harmonia-lang')).toBe('ru');
    expect(translate.use).toHaveBeenCalledWith('ru');
  });

  it('setLang() calls primeNG.setTranslation with the right locale object', () => {
    const { svc, primeNGSpy } = setup();
    svc.init();
    svc.setLang('en');
    expect(primeNGSpy.setTranslation).toHaveBeenCalledWith(
      expect.objectContaining({ firstDayOfWeek: 0 })
    );
  });

  it('init() calls primeNG.setTranslation for default language', () => {
    const { svc, primeNGSpy } = setup();
    svc.init();
    expect(primeNGSpy.setTranslation).toHaveBeenCalledWith(
      expect.objectContaining({ firstDayOfWeek: 1 })
    );
  });
});
