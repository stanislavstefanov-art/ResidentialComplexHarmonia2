import { Component, inject } from '@angular/core';
import { LanguageService } from '../language.service';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [],
  template: `
    <div class="lang-switcher">
      <button [class.lang-active]="langSvc.current() === 'bg'" (click)="langSvc.setLang('bg')">BG</button>
      <span class="lang-sep">|</span>
      <button [class.lang-active]="langSvc.current() === 'ru'" (click)="langSvc.setLang('ru')">РУ</button>
      <span class="lang-sep">|</span>
      <button [class.lang-active]="langSvc.current() === 'en'" (click)="langSvc.setLang('en')">EN</button>
    </div>
  `,
  styles: [`
    .lang-switcher { display: flex; align-items: center; gap: 2px; margin-left: 8px; }
    .lang-switcher button {
      background: transparent; border: none; color: rgba(255,255,255,.65);
      padding: 4px 6px; cursor: pointer; font-size: .8125rem; border-radius: 4px;
    }
    .lang-switcher button:hover { color: white; background: rgba(255,255,255,.1); }
    .lang-switcher button.lang-active { color: white; font-weight: 600; }
    .lang-sep { color: rgba(255,255,255,.3); font-size: .75rem; }
  `],
})
export class LanguageSwitcherComponent {
  readonly langSvc = inject(LanguageService);
}
