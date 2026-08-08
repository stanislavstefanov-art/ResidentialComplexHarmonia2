import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ExpenseDto, RecordExpenseRequest, RecordIncomeRequest, AnnualReportDto } from './models';
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

  recordIncome(body: RecordIncomeRequest): Observable<void> {
    return this.http.post<void>(`${API}/financial/income`, body);
  }

  getAnnualReport(year: number): Observable<AnnualReportDto> {
    return this.http.get<AnnualReportDto>(`${API}/financial/annual-report?year=${year}`);
  }

  downloadAnnualReportXlsx(year: number): Observable<Blob> {
    return this.http.get(`${API}/financial/annual-report?year=${year}&format=xlsx`, { responseType: 'blob' });
  }
}
