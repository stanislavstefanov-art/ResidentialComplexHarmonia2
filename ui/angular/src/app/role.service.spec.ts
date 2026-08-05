import { TestBed } from '@angular/core/testing';
import { RoleService } from './role.service';
import { MsalService } from '@azure/msal-angular';

describe('RoleService', () => {
  const setup = (claims?: Record<string, unknown>) => {
    const mockMsal = {
      instance: {
        getActiveAccount: () => claims ? { idTokenClaims: claims } : null,
        getAllAccounts: () => (claims ? [{ idTokenClaims: claims }] : []),
      },
    };
    TestBed.configureTestingModule({
      providers: [{ provide: MsalService, useValue: mockMsal }],
    });
    return TestBed.inject(RoleService);
  };

  it('returns true when roles contains admin', () => {
    const svc = setup({ roles: ['admin'] });
    expect(svc.isAdmin).toBe(true);
  });

  it('returns false when roles does not contain admin', () => {
    const svc = setup({ roles: ['resident'] });
    expect(svc.isAdmin).toBe(false);
  });

  it('returns false when no account is present', () => {
    const svc = setup();
    expect(svc.isAdmin).toBe(false);
  });

  it('returns false when MsalService is not provided', () => {
    TestBed.configureTestingModule({});
    const svc = TestBed.inject(RoleService);
    expect(svc.isAdmin).toBe(false);
  });
});
