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

  it('returns true when extension_role is admin', () => {
    const svc = setup({ extension_role: 'admin' });
    expect(svc.isAdmin).toBe(true);
  });

  it('returns false when extension_role is resident', () => {
    const svc = setup({ extension_role: 'resident' });
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
