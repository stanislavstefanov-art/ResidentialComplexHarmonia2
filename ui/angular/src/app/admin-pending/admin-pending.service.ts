import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PendingSignInDto, ActivateRequest, PurgeExpiredResult } from './models';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class AdminPendingService {
  private readonly http = inject(HttpClient);

  listPending(): Observable<PendingSignInDto[]> {
    return this.http.get<PendingSignInDto[]>(`${API}/admin/pending`);
  }

  activatePending(oid: string, req: ActivateRequest): Observable<void> {
    return this.http.post<void>(`${API}/admin/pending/${encodeURIComponent(oid)}/activate`, req);
  }

  purgeExpired(): Observable<PurgeExpiredResult> {
    return this.http.delete<PurgeExpiredResult>(`${API}/admin/pending/purge-expired`);
  }
}
