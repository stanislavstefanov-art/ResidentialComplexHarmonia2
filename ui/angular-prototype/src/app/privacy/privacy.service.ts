import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { EraseContactOutcome, MarkDepartedOutcome, PurgeExpiredResult } from './models';

@Injectable({ providedIn: 'root' })
export class PrivacyService {
  private http = inject(HttpClient);
  private base = 'http://localhost:5000';

  /** Resident Art. 17 self-erase — householdRef is session-derived (R2). */
  eraseMyContact(): Observable<void> {
    return this.http
      .delete(`${this.base}/directory/contact`, { responseType: 'text' })
      .pipe(map(() => undefined));
  }

  /** Board DSAR hard-delete. 204 = erased, 404 = not found. */
  eraseContact(householdRef: string): Observable<EraseContactOutcome> {
    return this.http
      .delete(`${this.base}/directory/${encodeURIComponent(householdRef)}/contact`, { responseType: 'text' })
      .pipe(
        map(() => 'erased' as EraseContactOutcome),
        catchError(err => {
          if (err.status === 404) return of('not-found' as EraseContactOutcome);
          return throwError(() => err);
        }),
      );
  }

  /** Board sets departure date on a household. DELETE 200 = ok, 404 = not found. */
  markDeparted(householdRef: string): Observable<MarkDepartedOutcome> {
    return this.http
      .delete(`${this.base}/directory/${encodeURIComponent(householdRef)}/departed`, { responseType: 'text' })
      .pipe(
        map(() => 'ok' as MarkDepartedOutcome),
        catchError(err => {
          if (err.status === 404) return of('not-found' as MarkDepartedOutcome);
          return throwError(() => err);
        }),
      );
  }

  /** Board annual retention sweep — deletes contacts whose departed date has expired. */
  purgeExpired(): Observable<PurgeExpiredResult> {
    return this.http.delete<PurgeExpiredResult>(`${this.base}/directory/purge-expired`);
  }
}
