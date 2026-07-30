import { inject, Injectable } from '@angular/core';
import { MsalService } from '@azure/msal-angular';

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly authService = inject(MsalService, { optional: true });

  get isAdmin(): boolean {
    if (!this.authService) return false;
    const account =
      this.authService.instance.getActiveAccount() ??
      this.authService.instance.getAllAccounts()[0];
    const claims = account?.idTokenClaims as Record<string, unknown> | undefined;
    return claims?.['extension_role'] === 'admin';
  }
}
