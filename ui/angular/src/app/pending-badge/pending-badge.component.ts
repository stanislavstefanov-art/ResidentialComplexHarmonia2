import { Component, OnInit, inject } from '@angular/core';
import { PendingCountService } from '../pending-count.service';

@Component({
  selector: 'app-pending-badge',
  standalone: true,
  template: `
    @if (svc.count() > 0) {
      <span class="pending-count">{{ svc.count() > 99 ? '99+' : svc.count() }}</span>
    }
  `,
  styles: [`
    .pending-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #ef4444;
      color: white;
      font-size: 0.625rem;
      font-weight: 700;
      border-radius: 0.5rem;
      min-width: 1rem;
      height: 1rem;
      padding: 0 0.25rem;
      margin-left: 0.25rem;
      vertical-align: middle;
      line-height: 1;
    }
  `],
})
export class PendingBadgeComponent implements OnInit {
  readonly svc = inject(PendingCountService);
  ngOnInit(): void { this.svc.start(); }
}
