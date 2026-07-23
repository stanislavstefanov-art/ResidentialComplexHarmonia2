import { Routes } from '@angular/router';
import { MsalGuard } from '@azure/msal-angular';
import { DirectoryListComponent } from './directory/directory-list.component';
import { ReservationsComponent } from './reservations/reservations.component';
import { FinancialComponent } from './financial/financial.component';
import { ExpenseComponent } from './expenses/expense.component';
import { MaintenanceFeeComponent } from './maintenance-fees/maintenance-fee.component';
import { PaymentComponent } from './payments/payment.component';
import { NotificationComponent } from './notifications/notification.component';
import { PrivacyComponent } from './privacy/privacy.component';
import { ContactEditComponent } from './contact-edit/contact-edit.component';

const guard = [MsalGuard];

export const routes: Routes = [
  { path: '', redirectTo: 'directory', pathMatch: 'full' },
  { path: 'directory', component: DirectoryListComponent, canActivate: guard },
  { path: 'reservations', component: ReservationsComponent, canActivate: guard },
  { path: 'financial', component: FinancialComponent, canActivate: guard },
  { path: 'expenses', component: ExpenseComponent, canActivate: guard },
  { path: 'maintenance-fees', component: MaintenanceFeeComponent, canActivate: guard },
  { path: 'payments', component: PaymentComponent, canActivate: guard },
  { path: 'notifications', component: NotificationComponent, canActivate: guard },
  { path: 'privacy', component: PrivacyComponent, canActivate: guard },
  { path: 'contact-edit', component: ContactEditComponent, canActivate: guard },
];
