import { Routes } from '@angular/router';
import { DirectoryListComponent } from './directory/directory-list.component';

export const routes: Routes = [
  { path: '', redirectTo: 'directory', pathMatch: 'full' },
  { path: 'directory', component: DirectoryListComponent },
];
