import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChargeDto, PaymentDto, PeriodSummaryDto } from './models';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class FinancialService {
  private readonly http = inject(HttpClient);

  getPeriodSummary(period: string): Observable<PeriodSummaryDto> {
    return this.http.get<PeriodSummaryDto>(`${API}/financial-summary?period=${period}`);
  }

  getMyCharges(): Observable<ChargeDto[]> {
    return this.http.get<ChargeDto[]>(`${API}/maintenance-fees/charges`);
  }

  getMyPayments(): Observable<PaymentDto[]> {
    return this.http.get<PaymentDto[]>(`${API}/payments`);
  }
}
