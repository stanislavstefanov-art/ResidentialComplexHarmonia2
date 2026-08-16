import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Household } from './household.models';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class HouseholdService {
  private readonly http = inject(HttpClient);

  list(): Observable<Household[]> {
    return this.http.get<Household[]>(`${API}/households`);
  }

  // householdRef goes in the query string, not the path: multi-apartment refs contain
  // '/' which ASP.NET Core leaves undecoded (%2F) in a path segment and never matches.
  upsert(householdRef: string, sqMeters: number): Observable<void> {
    return this.http.put<void>(`${API}/households/item?householdRef=${encodeURIComponent(householdRef)}`, { sqMeters });
  }

  remove(householdRef: string): Observable<void> {
    return this.http.delete<void>(`${API}/households/item?householdRef=${encodeURIComponent(householdRef)}`);
  }
}
