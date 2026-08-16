import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SwPush } from '@angular/service-worker';
import { NavComponent } from '../nav/nav.component';
import { NotificationService } from './notification.service';
import { NotificationRecordDto } from './models';
import { RoleService } from '../role.service';

type PushStatus = 'checking' | 'subscribed' | 'not-subscribed' | 'unsupported' | 'denied';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, CardModule, ButtonModule, ProgressSpinnerModule, TranslatePipe, NavComponent],
  template: `
    <div class="harmonia-shell">
      <app-nav [role]="role" (roleChange)="role = $event; reload()" />

      <main class="harmonia-content">

        @if (role === 'admin') {
          <p-card styleClass="mb-card">
            <ng-template #title>{{ 'notifications.send' | translate }}</ng-template>
            <ng-template #content>
              <form data-testid="announce-form" class="record-form" (ngSubmit)="onSubmit()">
                <div class="form-col">
                  <div class="form-row">
                    <label>{{ 'notifications.title' | translate }}</label>
                    <input type="text" [(ngModel)]="form.title" name="title" required class="form-input" [placeholder]="'notifications.titlePlaceholder' | translate" />
                  </div>
                  <div class="form-row">
                    <label>{{ 'notifications.body' | translate }}</label>
                    <textarea [(ngModel)]="form.body" name="body" required class="form-input form-textarea" rows="3" [placeholder]="'notifications.bodyPlaceholder' | translate"></textarea>
                  </div>
                </div>
                <button type="submit" data-testid="submit-btn" class="submit-btn" [disabled]="submitting()">{{ 'notifications.send' | translate }}</button>
                @if (submitSuccess()) {
                  <p data-testid="submit-success" class="success-msg">{{ 'notifications.sent' | translate }}</p>
                }
                @if (submitError()) {
                  <p data-testid="submit-error" class="error-msg">{{ submitError() }}</p>
                }
              </form>
            </ng-template>
          </p-card>
        }

        @if (pushStatus() !== 'unsupported' && pushStatus() !== 'checking') {
          <p-card styleClass="mb-card">
            <ng-template #title>{{ 'notifications.pushTitle' | translate }}</ng-template>
            <ng-template #content>
              @if (pushStatus() === 'denied') {
                <p class="push-denied">{{ 'notifications.pushDenied' | translate }}</p>
              } @else {
                <div class="push-row">
                  <span class="push-label">
                    {{ (pushStatus() === 'subscribed' ? 'notifications.pushEnabled' : 'notifications.pushDisabled') | translate }}
                  </span>
                  @if (pushStatus() === 'subscribed') {
                    <button class="push-btn push-btn-off" [disabled]="pushBusy()" (click)="disablePush()">
                      {{ 'notifications.pushDisableBtn' | translate }}
                    </button>
                  } @else {
                    <button class="push-btn push-btn-on" [disabled]="pushBusy()" (click)="enablePush()">
                      {{ 'notifications.pushEnableBtn' | translate }}
                    </button>
                  }
                </div>
                @if (pushError()) {
                  <p class="error-msg">{{ pushError() }}</p>
                }
              }
            </ng-template>
          </p-card>
        }

        <p-card>
          <ng-template #title>{{ 'notifications.history' | translate }}</ng-template>
          <ng-template #content>
            @if (loading()) {
              <div class="center-state"><p-progressspinner strokeWidth="4" [style]="{width:'48px',height:'48px'}" /></div>
            }
            @if (error()) {
              <div data-testid="error-state" class="error-state">
                <p>{{ error() }}</p>
                <button (click)="reload()">{{ 'common.retry' | translate }}</button>
              </div>
            }
            @if (!loading() && !error()) {
              <table class="notif-table">
                <thead>
                  <tr>
                    <th>{{ 'notifications.sentAt' | translate }}</th>
                    <th>{{ 'notifications.title' | translate }}</th>
                    <th>{{ 'notifications.channel' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (n of history(); track n.id) {
                    <tr [attr.data-testid]="'notification-row-' + n.id">
                      <td>{{ formatDate(n.sentAt) }}</td>
                      <td>{{ n.title }}</td>
                      <td>{{ n.channel }}</td>
                    </tr>
                  }
                  @if (history().length === 0) {
                    <tr><td colspan="3" class="empty-cell">{{ 'notifications.none' | translate }}</td></tr>
                  }
                </tbody>
              </table>
            }
          </ng-template>
        </p-card>

      </main>
    </div>
  `,
  styles: [`
    .harmonia-shell { min-height: 100vh; background: #f5f5f0; }
    .harmonia-content { max-width: 900px; margin: 0 auto; padding: 24px 16px; display: flex; flex-direction: column; gap: 20px; }
    ::ng-deep .mb-card { margin-bottom: 0 !important; }
    .record-form {}
    .form-col { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
    .form-row { display: flex; flex-direction: column; gap: 4px; }
    .form-row label { font-size: .8125rem; font-weight: 500; color: #555; }
    .form-input { padding: 7px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: .875rem; }
    .form-textarea { resize: vertical; font-family: inherit; }
    .submit-btn { background: #2e6b4f; color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: .9rem; }
    .submit-btn:hover { background: #245a40; }
    .submit-btn:disabled { opacity: .6; cursor: not-allowed; }
    .success-msg { color: #2e6b4f; font-weight: 500; margin-top: 8px; }
    .error-msg { color: #c00; margin-top: 8px; }
    .notif-table { width: 100%; border-collapse: collapse; }
    .notif-table th, .notif-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: .875rem; }
    .notif-table th { background: #f9f9f7; font-weight: 600; color: #555; }
    .empty-cell { text-align: center; color: #999; padding: 16px; }
    .center-state { display: flex; justify-content: center; padding: 32px; }
    .error-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px; color: #c00; }
    .push-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .push-label { font-size: .875rem; color: #555; }
    .push-denied { font-size: .875rem; color: #c00; margin: 0; }
    .push-btn { padding: 6px 16px; border-radius: 6px; font-size: .875rem; cursor: pointer; border: none; font-weight: 500; }
    .push-btn:disabled { opacity: .6; cursor: not-allowed; }
    .push-btn-on { background: #2e6b4f; color: white; }
    .push-btn-on:hover:not(:disabled) { background: #245a40; }
    .push-btn-off { background: transparent; border: 1px solid #999 !important; color: #555; }
    .push-btn-off:hover:not(:disabled) { border-color: #c00 !important; color: #c00; }
  `],
})
export class NotificationComponent implements OnInit {
  @Input() role: 'resident' | 'admin' = 'resident';

  private readonly svc     = inject(NotificationService);
  private readonly t       = inject(TranslateService);
  private readonly swPush  = inject(SwPush, { optional: true });
  readonly isAdmin = inject(RoleService).isAdmin;

  readonly history       = signal<NotificationRecordDto[]>([]);
  readonly loading       = signal(true);
  readonly error         = signal<string | null>(null);
  readonly submitSuccess = signal(false);
  readonly submitError   = signal<string | null>(null);
  readonly submitting    = signal(false);
  readonly pushStatus    = signal<PushStatus>('checking');
  readonly pushBusy      = signal(false);
  readonly pushError     = signal<string | null>(null);

  form = { title: '', body: '' };

  ngOnInit(): void {
    this.reload();
    this.checkPushStatus();
  }

  reload(): void { this.loadHistory(); }

  formatDate(s: string): string {
    return new Date(s).toLocaleDateString();
  }

  private async checkPushStatus(): Promise<void> {
    if (!this.swPush?.isEnabled || !('PushManager' in window)) {
      this.pushStatus.set('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      this.pushStatus.set('denied');
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    this.pushStatus.set(sub ? 'subscribed' : 'not-subscribed');
  }

  async enablePush(): Promise<void> {
    if (!this.swPush) return;
    this.pushBusy.set(true);
    this.pushError.set(null);
    try {
      const { publicKey } = await this.svc.getVapidPublicKey().toPromise() as { publicKey: string };
      const sub = await this.swPush.requestSubscription({ serverPublicKey: publicKey });
      const p256dh = sub.getKey('p256dh');
      const auth   = sub.getKey('auth');
      if (!p256dh || !auth) throw new Error('missing keys');
      const toBase64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
      await this.svc.saveSubscription(sub.endpoint, toBase64(p256dh), toBase64(auth)).toPromise();
      this.pushStatus.set('subscribed');
    } catch {
      if (Notification.permission === 'denied') {
        this.pushStatus.set('denied');
      } else {
        this.pushError.set(this.t.instant('notifications.errSubscribe'));
      }
    } finally {
      this.pushBusy.set(false);
    }
  }

  async disablePush(): Promise<void> {
    this.pushBusy.set(true);
    this.pushError.set(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await this.svc.removeSubscription().toPromise();
      this.pushStatus.set('not-subscribed');
    } catch {
      this.pushError.set(this.t.instant('notifications.errUnsubscribe'));
    } finally {
      this.pushBusy.set(false);
    }
  }

  private loadHistory(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.getHistory().subscribe({
      next: list => { this.history.set(list); this.loading.set(false); },
      error: () => { this.error.set(this.t.instant('notifications.errLoad')); this.loading.set(false); },
    });
  }

  onSubmit(): void {
    this.submitSuccess.set(false);
    this.submitError.set(null);
    if (!this.form.title || !this.form.body) {
      this.submitError.set(this.t.instant('notifications.errRequired'));
      return;
    }
    this.submitting.set(true);
    this.svc.sendAnnouncement({ title: this.form.title, body: this.form.body }).subscribe({
      next: () => {
        this.submitSuccess.set(true);
        this.form = { title: '', body: '' };
        this.submitting.set(false);
        this.reload();
      },
      error: () => {
        this.submitError.set(this.t.instant('notifications.errSend'));
        this.submitting.set(false);
      },
    });
  }
}
