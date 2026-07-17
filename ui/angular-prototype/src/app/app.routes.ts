import { Routes } from '@angular/router';
import { DirectoryListComponent } from './directory/directory-list.component';
import { ReservationsComponent } from './reservations/reservations.component';
import { FinancialComponent } from './financial/financial.component';
import { ExpenseComponent } from './expenses/expense.component';

export const routes: Routes = [
  { path: '', redirectTo: 'directory', pathMatch: 'full' },
  { path: 'directory', component: DirectoryListComponent },
  { path: 'reservations', component: ReservationsComponent },
  { path: 'financial', component: FinancialComponent },
  { path: 'expenses', component: ExpenseComponent },
];
