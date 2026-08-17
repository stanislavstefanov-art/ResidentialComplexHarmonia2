import { Component } from '@angular/core';
import { TabsModule } from 'primeng/tabs';
import { TranslatePipe } from '@ngx-translate/core';
import { FeesTabComponent } from './fees-tab.component';
import { PaymentsTabComponent } from './payments-tab.component';

@Component({
  selector: 'app-income-tab',
  standalone: true,
  imports: [TabsModule, TranslatePipe, FeesTabComponent, PaymentsTabComponent],
  template: `
    <p-tabs value="charged">
      <p-tablist>
        <p-tab value="charged">{{ 'finance.subTabCharged' | translate }}</p-tab>
        <p-tab value="received">{{ 'finance.subTabReceived' | translate }}</p-tab>
      </p-tablist>
      <p-tabpanels>
        <p-tabpanel value="charged"><app-fees-tab /></p-tabpanel>
        <p-tabpanel value="received"><app-payments-tab /></p-tabpanel>
      </p-tabpanels>
    </p-tabs>
  `,
})
export class IncomeTabComponent {}
