import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { RoleService } from './role.service';

export const adminGuard: CanActivateFn = () => {
  if (inject(RoleService).isAdmin) return true;
  inject(Router).navigate(['/notifications']);
  return false;
};
