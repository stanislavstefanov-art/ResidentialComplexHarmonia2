import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ExpenseDto, RecordExpenseRequest } from './models';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly http = inject(HttpClient);

  getExpenses(): Observable<ExpenseDto[]> {
    return this.http.get<ExpenseDto[]>(`${API}/expenses`);
  }

  recordExpense(body: RecordExpenseRequest): Observable<ExpenseDto> {
    return this.http.post<ExpenseDto>(`${API}/expenses`, body);
  }
}
