import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { NotificationService } from './notification.service';
import { NotificationRecordDto } from './models';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, CardModule, ButtonModule, ProgressSpinnerModule],
  template: `
    <div class="harmonia-shell">
      <header class="harmonia-header">
        <span class="harmonia-logo">🏡 Harmonia</span>
        <span class="harmonia-subtitle">Resident Portal</span>
        <div class="flex-spacer"></div>
        <a routerLink="/directory" class="nav-link">Directory</a>
        <a routerLink="/reservations" class="nav-link">Reservations</a>
        <a routerLink="/financial" class="nav-link">Finance</a>
        <a routerLink="/expenses" class="nav-link">Expenses</a>
        <a routerLink="/maintenance-fees" class="nav-link">Fees</a>
        <a routerLink="/payments" class="nav-link">Payments</a>
        <a routerLink="/notifications" class="nav-link nav-active">Notifications</a>
        <a routerLink="/privacy" class="nav-link">Privacy</a>
        <span class="role-toggle">
          <button [class.role-active]="role === 'resident'" (click)="role = 'resident'; reload()" class="role-btn">Resident</button>
          <button [class.role-active]="role === 'admin'" (click)="role = 'admin'; reload()" class="role-btn">Admin</button>
        </span>
      </header>

      <main class="harmonia-content">

        @if (role === 'admin') {
          <p-card styleClass="mb-card">
            <ng-template #title>Send Announcement</ng-template>
            <ng-template #content>
              <form data-testid="announce-form" class="record-form" (ngSubmit)="onSubmit()">
                <div class="form-col">
                  <div class="form-row">
                    <label>Title</label>
                    <input type="text" [(ngModel)]="form.title" name="title" required class="form-input" placeholder="Announcement title" />
                  </div>
                  <div class="form-row">
                    <label>Body</label>
                    <textarea [(ngModel)]="form.body" name="body" required class="form-input form-textarea" rows="3" placeholder="Message body"></textarea>
                  </div>
                </div>
                <button type="submit" data-testid="submit-btn" class="submit-btn" [disabled]="submitting()">Send Announcement</button>
                @if (submitSuccess()) {
                  <p data-testid="submit-success" class="success-msg">Announcement sent.</p>
                }
                @if (submitError()) {
                  <p data-testid="submit-error" class="error-msg">{{ submitError() }}</p>
                }
              </form>
            </ng-template>
          </p-card>
        }

        <p-card>
          <ng-template #title>Notification History</ng-template>
          <ng-template #content>
            @if (loading()) {
              <div class="center-state"><p-progressspinner strokeWidth="4" [style]="{width:'48px',height:'48px'}" /></div>
            }
            @if (error()) {
              <div data-testid="error-state" class="error-state">
                <p>{{ error() }}</p>
                <button (click)="reload()">Retry</button>
              </div>
            }
            @if (!loading() && !error()) {
              <table class="notif-table">
                <thead>
                  <tr>
                    <th>Sent</th>
                    <th>Title</th>
                    <th>Channel</th>
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
                    <tr><td colspan="3" class="empty-cell">No notifications on record.</td></tr>
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
    .harmonia-header {
      display: flex; align-items: center; gap: 12px; padding: 12px 24px;
      background: #2e6b4f; color: white;
    }
    .harmonia-logo { font-size: 1.25rem; font-weight: 700; }
    .harmonia-subtitle { opacity: .7; font-size: .875rem; }
    .flex-spacer { flex: 1; }
    .nav-link { color: rgba(255,255,255,.75); text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: .875rem; }
    .nav-link:hover { background: rgba(255,255,255,.1); }
    .nav-active { background: rgba(255,255,255,.18); color: white; font-weight: 600; }
    .role-toggle { display: flex; border-radius: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,.3); margin-left: 8px; }
    .role-btn { background: transparent; color: rgba(255,255,255,.75); border: none; padding: 4px 12px; cursor: pointer; font-size: .8125rem; }
    .role-btn.role-active { background: rgba(255,255,255,.22); color: white; font-weight: 600; }
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
  `],
})
export class NotificationComponent implements OnInit {
  @Input() role: 'resident' | 'admin' = 'resident';

  private readonly svc = inject(NotificationService);

  readonly history       = signal<NotificationRecordDto[]>([]);
  readonly loading       = signal(true);
  readonly error         = signal<string | null>(null);
  readonly submitSuccess = signal(false);
  readonly submitError   = signal<string | null>(null);
  readonly submitting    = signal(false);

  form = { title: '', body: '' };

  ngOnInit(): void { this.reload(); }

  reload(): void { this.loadHistory(); }

  formatDate(s: string): string {
    return new Date(s).toLocaleDateString();
  }

  private loadHistory(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.getHistory().subscribe({
      next: list => { this.history.set(list); this.loading.set(false); },
      error: () => { this.error.set('Could not load notifications. Please try again.'); this.loading.set(false); },
    });
  }

  onSubmit(): void {
    this.submitSuccess.set(false);
    this.submitError.set(null);
    if (!this.form.title || !this.form.body) {
      this.submitError.set('Title and body are required.');
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
        this.submitError.set('Could not send announcement. Please try again.');
        this.submitting.set(false);
      },
    });
  }
}
