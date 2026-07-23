import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PaymentDto, RecordPaymentRequest, BalanceDto } from './models';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);

  getMyPayments(): Observable<PaymentDto[]> {
    return this.http.get<PaymentDto[]>(`${API}/payments`);
  }

  getAllPayments(): Observable<PaymentDto[]> {
    return this.http.get<PaymentDto[]>(`${API}/payments/all`);
  }

  recordPayment(body: RecordPaymentRequest): Observable<PaymentDto> {
    return this.http.post<PaymentDto>(`${API}/payments`, body);
  }

  getBalance(period?: string): Observable<BalanceDto> {
    const params = period ? new HttpParams().set('period', period) : undefined;
    return this.http.get<BalanceDto>(`${API}/balance`, { params });
  }
}
