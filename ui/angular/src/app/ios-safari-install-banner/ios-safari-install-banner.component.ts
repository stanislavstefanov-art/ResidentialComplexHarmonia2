import { Component, OnInit, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

const STORAGE_KEY = 'harmonia-ios-install-dismissed';

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua);
  const standalone = !!(navigator as Navigator & { standalone?: boolean }).standalone;
  return ios && !standalone && !/CriOS/.test(ua) && !/FxiOS/.test(ua);
}

@Component({
  selector: 'app-ios-safari-install-banner',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    @if (visible()) {
      <div class="ios-install-banner">
        <span>{{ 'pwa.iosInstallBanner' | translate }}</span>
        <button (click)="dismiss()" [attr.aria-label]="'pwa.dismiss' | translate">✕</button>
      </div>
    }
  `,
  styles: [`
    .ios-install-banner {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 1400;
      background: #2e6b4f;
      color: white;
      display: flex;
      align-items: center;
      padding: 12px 16px;
      gap: 8px;
      box-shadow: 0 -2px 8px rgba(0,0,0,.2);
    }
    .ios-install-banner span {
      flex: 1;
      font-size: 0.875rem;
    }
    .ios-install-banner button {
      background: transparent;
      border: none;
      color: white;
      font-size: 1.1rem;
      line-height: 1;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      flex-shrink: 0;
    }
    .ios-install-banner button:hover {
      background: rgba(255,255,255,.15);
    }
  `],
})
export class IosSafariInstallBannerComponent implements OnInit {
  visible = signal(false);

  ngOnInit(): void {
    if (isIosSafari() && !localStorage.getItem(STORAGE_KEY)) {
      this.visible.set(true);
    }
  }

  dismiss(): void {
    localStorage.setItem(STORAGE_KEY, '1');
    this.visible.set(false);
  }
}
