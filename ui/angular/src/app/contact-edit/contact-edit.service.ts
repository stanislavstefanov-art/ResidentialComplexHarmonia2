import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { MyContactDto, UpdateContactRequest } from './models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ContactEditService {
  private http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  /** Returns the current resident's own contact, or null if no row exists or access is denied. */
  getMyContact(): Observable<MyContactDto | null> {
    return this.http.get<MyContactDto>(`${this.base}/directory/contact`).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 404 || err.status === 403) return of(null);
        throw err;
      })
    );
  }

  /** Resident updates their own contact — householdRef is session-derived (R2). */
  updateMyContact(body: UpdateContactRequest): Observable<void> {
    return this.http
      .put(`${this.base}/directory/contact`, body, { responseType: 'text' })
      .pipe(map(() => undefined));
  }

  /** Board updates any household's contact details. */
  updateContact(householdRef: string, body: UpdateContactRequest): Observable<void> {
    return this.http
      .put(`${this.base}/directory/${encodeURIComponent(householdRef)}/contact`, body, { responseType: 'text' })
      .pipe(map(() => undefined));
  }

  /** Board updates internal notes for a household. */
  updateNotes(householdRef: string, notes: string | null): Observable<void> {
    return this.http
      .put(`${this.base}/directory/${encodeURIComponent(householdRef)}/notes`, { notes }, { responseType: 'text' })
      .pipe(map(() => undefined));
  }
}
