import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { LanguageSwitcherComponent } from './language-switcher.component';
import { LanguageService } from '../language.service';
import { Observable, of } from 'rxjs';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';

class FakeLoader implements TranslateLoader {
  getTranslation(_lang: string): Observable<object> {
    return of({});
  }
}

function provideTranslateTesting() {
  return provideTranslateService({
    loader: { provide: TranslateLoader, useClass: FakeLoader },
  });
}

function setup(currentLang: 'bg' | 'ru' | 'en' = 'bg') {
  const mockLangSvc = {
    current: signal(currentLang),
    setLang: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [LanguageSwitcherComponent],
    providers: [
      provideTranslateTesting(),
      { provide: LanguageService, useValue: mockLangSvc },
    ],
  });
  const fixture: ComponentFixture<LanguageSwitcherComponent> = TestBed.createComponent(LanguageSwitcherComponent);
  fixture.detectChanges();
  const el: HTMLElement = fixture.nativeElement;
  return { fixture, el, mockLangSvc };
}

describe('LanguageSwitcherComponent', () => {
  it('renders BG, РУ, and EN buttons', () => {
    const { el } = setup();
    const buttons = el.querySelectorAll('button');
    const labels = Array.from(buttons).map(b => b.textContent?.trim());
    expect(labels).toContain('BG');
    expect(labels).toContain('РУ');
    expect(labels).toContain('EN');
  });

  it('BG button has lang-active class when current language is bg', () => {
    const { el } = setup('bg');
    const buttons = el.querySelectorAll('button');
    const bgBtn = Array.from(buttons).find(b => b.textContent?.trim() === 'BG');
    expect(bgBtn?.classList.contains('lang-active')).toBe(true);
  });

  it('РУ button does not have lang-active class when current language is bg', () => {
    const { el } = setup('bg');
    const buttons = el.querySelectorAll('button');
    const ruBtn = Array.from(buttons).find(b => b.textContent?.trim() === 'РУ');
    expect(ruBtn?.classList.contains('lang-active')).toBe(false);
  });

  it('clicking EN button calls languageService.setLang("en")', () => {
    const { el, mockLangSvc } = setup('bg');
    const buttons = el.querySelectorAll('button');
    const enBtn = Array.from(buttons).find(b => b.textContent?.trim() === 'EN') as HTMLButtonElement;
    enBtn.click();
    expect(mockLangSvc.setLang).toHaveBeenCalledWith('en');
  });
});
