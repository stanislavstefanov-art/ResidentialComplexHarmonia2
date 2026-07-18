import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChargeDto, RecordChargeRequest } from './models';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class MaintenanceFeeService {
  private readonly http = inject(HttpClient);

  getMyCharges(): Observable<ChargeDto[]> {
    return this.http.get<ChargeDto[]>(`${API}/maintenance-fees/charges`);
  }

  getAllCharges(): Observable<ChargeDto[]> {
    return this.http.get<ChargeDto[]>(`${API}/maintenance-fees/charges/all`);
  }

  recordCharge(householdRef: string, body: RecordChargeRequest): Observable<ChargeDto> {
    return this.http.post<ChargeDto>(`${API}/maintenance-fees/charges/${householdRef}`, body);
  }
}
