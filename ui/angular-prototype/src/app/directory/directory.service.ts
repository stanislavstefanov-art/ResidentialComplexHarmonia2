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

  adminUpdateContact(householdRef: string, req: AdminUpdateContactRequest): Observable<void> {
    return this.http.put<void>(`${API}/directory/${householdRef}/contact`, req);
  }

  markDeparted(householdRef: string): Observable<void> {
    return this.http.delete<void>(`${API}/directory/${householdRef}/departed`);
  }
}
