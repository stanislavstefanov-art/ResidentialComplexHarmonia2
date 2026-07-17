import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { UpdateContactRequest } from './models';

@Injectable({ providedIn: 'root' })
export class ContactEditService {
  private http = inject(HttpClient);
  private base = 'http://localhost:5000';

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
