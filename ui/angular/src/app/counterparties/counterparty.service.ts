import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Counterparty, CounterpartyInput } from './counterparty.models';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class CounterpartyService {
  private readonly http = inject(HttpClient);

  list(): Observable<Counterparty[]> {
    return this.http.get<Counterparty[]>(`${API}/counterparties`);
  }
  create(input: CounterpartyInput): Observable<Counterparty> {
    return this.http.post<Counterparty>(`${API}/counterparties`, input);
  }
  update(id: string, input: CounterpartyInput): Observable<Counterparty> {
    return this.http.put<Counterparty>(`${API}/counterparties/${id}`, input);
  }
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/counterparties/${id}`);
  }
}
