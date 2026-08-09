import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  AdminDirectoryListResponse,
  AdminUpdateContactRequest,
  DirectoryEntry,
  DirectoryEntryAdmin,
  DirectoryListResponse,
  UpdateContactRequest,
} from './models';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class DirectoryService {
  private readonly http = inject(HttpClient);

  getDirectory(): Observable<DirectoryEntry[]> {
    return this.http
      .get<DirectoryListResponse>(`${API}/directory`)
      .pipe(map(r => r.entries ?? []));
  }

  getAdminDirectory(): Observable<DirectoryEntryAdmin[]> {
    return this.http
      .get<AdminDirectoryListResponse>(`${API}/directory/admin`)
      .pipe(map(r => r.entries ?? []));
  }

  updateMyContact(req: UpdateContactRequest): Observable<void> {
    return this.http.put<void>(`${API}/directory/contact`, req);
  }

  // householdRef goes in the query string, not the path: multi-apartment refs contain
  // '/' which ASP.NET Core leaves undecoded (%2F) in a path segment and never matches.
  adminUpdateContact(householdRef: string, req: AdminUpdateContactRequest): Observable<void> {
    return this.http.put<void>(`${API}/directory/board/contact?householdRef=${encodeURIComponent(householdRef)}`, req);
  }

  markDeparted(householdRef: string): Observable<void> {
    return this.http.delete<void>(`${API}/directory/board/departed?householdRef=${encodeURIComponent(householdRef)}`);
  }

  eraseMyContact(): Observable<void> {
    return this.http.delete<void>(`${API}/directory/contact`);
  }

  eraseContact(householdRef: string): Observable<void> {
    return this.http.delete<void>(`${API}/directory/board/contact?householdRef=${encodeURIComponent(householdRef)}`);
  }
}
