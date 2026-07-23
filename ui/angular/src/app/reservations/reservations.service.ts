import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ClaimResponse, DaySlotsResponse } from './models';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class ReservationsService {
  private readonly http = inject(HttpClient);

  getSlots(day: string): Observable<DaySlotsResponse> {
    return this.http.get<DaySlotsResponse>(`${API}/days/${day}/slots`);
  }

  claimSlot(day: string, slotKey: string): Observable<ClaimResponse> {
    return this.http.post<ClaimResponse>(`${API}/days/${day}/slots/${slotKey}/claim`, null);
  }
}
