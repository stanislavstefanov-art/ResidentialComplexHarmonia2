import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { TranslatePipe } from '@ngx-translate/core';
import { NavComponent } from '../nav/nav.component';
import { RoleService } from '../role.service';
import { IncomeTabComponent } from './tabs/income-tab.component';
import { OutcomeTabComponent } from './tabs/outcome-tab.component';
import { ReportTabComponent } from './tabs/report-tab.component';
import { ResidentFinancialComponent } from './tabs/resident-financial.component';

@Component({
  selector: 'app-financial',
  standalone: true,
  imports: [
    CommonModule, RouterModule,
    CardModule, ButtonModule, TabsModule,
    TranslatePipe, NavComponent,
    IncomeTabComponent, OutcomeTabComponent, ReportTabComponent,
    ResidentFinancialComponent,
  ],
  template: `
    <div class="harmonia-shell">
      <app-nav [role]="role" (roleChange)="role = $event" />

      <main class="harmonia-content">
        <p-card>
          <ng-template #content>

            @if (role === 'admin') {
              <p-tabs value="income">
                <p-tablist>
                  <p-tab value="income">{{ 'finance.tabIncome' | translate }}</p-tab>
                  <p-tab value="outcome">{{ 'finance.tabOutcome' | translate }}</p-tab>
                  <p-tab value="report">{{ 'finance.tabReport' | translate }}</p-tab>
                </p-tablist>
                <p-tabpanels>
                  <p-tabpanel value="income"><app-income-tab /></p-tabpanel>
                  <p-tabpanel value="outcome"><app-outcome-tab /></p-tabpanel>
                  <p-tabpanel value="report"><app-report-tab /></p-tabpanel>
                </p-tabpanels>
              </p-tabs>
            } @else {
              <app-resident-financial />
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
      overflow-x: auto; scrollbar-width: none;
    }
    .harmonia-header::-webkit-scrollbar { display: none; }
    .harmonia-logo { font-size: 1.25rem; font-weight: 700; white-space: nowrap; }
    .harmonia-subtitle { opacity: .7; font-size: .875rem; white-space: nowrap; }
    .flex-spacer { flex: 1; }
    .nav-link { color: rgba(255,255,255,.75); text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: .875rem; white-space: nowrap; }
    .nav-link:hover { background: rgba(255,255,255,.1); }
    .nav-active { background: rgba(255,255,255,.18); color: white; font-weight: 600; }
    .role-toggle { display: flex; border-radius: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,.3); margin-left: 8px; flex-shrink: 0; }
    .role-btn { background: transparent; color: rgba(255,255,255,.75); border: none; padding: 4px 12px; cursor: pointer; font-size: .8125rem; white-space: nowrap; }
    .role-btn.role-active { background: rgba(255,255,255,.22); color: white; font-weight: 600; }
    .harmonia-content { max-width: 960px; margin: 0 auto; padding: 24px 16px; }
  `],
})
export class FinancialComponent {
  readonly isAdmin = inject(RoleService).isAdmin;
  role: 'resident' | 'admin' = inject(RoleService).isAdmin ? 'admin' : 'resident';
}
